#!/usr/bin/env bash
set -euo pipefail

event_name="${GITHUB_EVENT_NAME:-}"
pr_base_sha="${PR_BASE_SHA:-}"
workflow_input_base_sha="${WORKFLOW_INPUT_BASE_SHA:-}"
default_branch="${DEFAULT_BRANCH:-main}"
changed_file="${CHANGED_FILE_OUTPUT:-/tmp/bogatka-changed-files.txt}"

error() {
  echo "::error::$*" >&2
  exit 1
}

resolve_commit() {
  local candidate="${1:-}"
  [[ -n "$candidate" ]] || return 1
  git rev-parse --verify "${candidate}^{commit}" 2>/dev/null
}

echo "Event name: ${event_name:-<empty>}"
base_sha=""
base_source=""

case "$event_name" in
  pull_request)
    [[ -n "$pr_base_sha" ]] || error "pull_request event did not provide github.event.pull_request.base.sha"
    base_sha="$(resolve_commit "$pr_base_sha")" || error "Pull-request base SHA '$pr_base_sha' does not exist in the local checkout"
    base_source="pull_request base SHA"
    ;;
  workflow_dispatch)
    if [[ -n "$workflow_input_base_sha" ]]; then
      base_sha="$(resolve_commit "$workflow_input_base_sha")" || error "Explicit workflow_dispatch base_sha '$workflow_input_base_sha' does not exist in the local checkout"
      base_source="workflow_dispatch input base_sha"
    else
      remote_default="origin/$default_branch"
      if git remote get-url origin >/dev/null 2>&1; then
        if ! git fetch --no-tags origin "$default_branch:refs/remotes/origin/$default_branch"; then
          echo "Warning: could not refresh $remote_default; attempting locally available fallback." >&2
        fi
      fi
      if resolve_commit "$remote_default" >/dev/null 2>&1; then
        merge_base="$(git merge-base HEAD "$remote_default" 2>/dev/null || true)"
        if [[ -n "$merge_base" ]] && resolve_commit "$merge_base" >/dev/null 2>&1; then
          base_sha="$(resolve_commit "$merge_base")"
          base_source="merge base with $remote_default"
        fi
      fi
      if [[ -z "$base_sha" ]] && resolve_commit 'HEAD^' >/dev/null 2>&1; then
        base_sha="$(resolve_commit 'HEAD^')"
        base_source="safe fallback HEAD^"
      fi
      [[ -n "$base_sha" ]] || error "Unable to resolve a valid comparison base from origin/$default_branch or HEAD^"
    fi
    ;;
  *)
    error "Unsupported event '$event_name'; expected pull_request or workflow_dispatch"
    ;;
esac

[[ -n "$base_sha" ]] || error "Resolved comparison base is empty"
git rev-parse --verify "${base_sha}^{commit}" >/dev/null 2>&1 || error "Resolved base '$base_sha' is not a valid local commit"
diff_merge_base="$(git merge-base "$base_sha" HEAD 2>/dev/null || true)"
[[ -n "$diff_merge_base" ]] || error "Resolved base '$base_sha' does not share a merge base with HEAD"
git rev-parse --verify "${diff_merge_base}^{commit}" >/dev/null 2>&1 || error "Resolved diff merge base '$diff_merge_base' is not a valid local commit"

echo "Resolved base SHA: $base_sha"
echo "Base source: $base_source"
echo "Diff merge base SHA: $diff_merge_base"
mkdir -p "$(dirname "$changed_file")"
if ! git diff --name-only "${base_sha}...HEAD" > "$changed_file"; then
  error "Failed to evaluate changed files between base '$base_sha' and HEAD"
fi
echo "Changed files:"
if [[ -s "$changed_file" ]]; then
  cat "$changed_file"
else
  echo "(none)"
fi
changed_count="$(awk 'NF { count += 1 } END { print count + 0 }' "$changed_file")"
echo "Valid diff evaluated; changed file count: $changed_count"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "base_sha=$base_sha"
    echo "base_source=$base_source"
    echo "diff_merge_base=$diff_merge_base"
    echo "changed_file=$changed_file"
    echo "changed_count=$changed_count"
  } >> "$GITHUB_OUTPUT"
fi
