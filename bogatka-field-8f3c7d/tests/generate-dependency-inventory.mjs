import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const appRoot = path.resolve(process.cwd(), 'bogatka-field-8f3c7d');
const outputMd = path.join(appRoot, 'docs', 'dependency-inventory.md');
const evidencePath = path.join(appRoot, 'docs', 'runtime-request-evidence.json');
const check = process.argv.includes('--check');
const argumentValue = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
};
const outputJson = path.resolve(
  argumentValue('--json-output') ||
  process.env.BOGATKA_DEPENDENCY_INVENTORY_JSON ||
  path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'bogatka-dependency-inventory.json')
);

const extensions = new Set(['.js', '.mjs', '.css', '.html']);
const walk = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return walk(absolute);
  return extensions.has(path.extname(entry.name).toLowerCase()) ? [absolute] : [];
});
const slash = value => value.split(path.sep).join('/');
const rel = absolute => slash(path.relative(appRoot, absolute));
const files = walk(appRoot).sort((a, b) => rel(a).localeCompare(rel(b)));
const texts = new Map(files.map(file => [rel(file), fs.readFileSync(file, 'utf8')]));
const paths = new Set(texts.keys());
const observed = new Set(fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : []);

const references = new Map();
const loads = new Map();
const addEdge = (from, to) => {
  if (!paths.has(to)) return;
  if (!references.has(to)) references.set(to, new Set());
  if (!loads.has(from)) loads.set(from, new Set());
  references.get(to).add(from);
  loads.get(from).add(to);
};
const resolveSpec = (from, spec) => {
  if (/^(?:https?:|data:|#)/i.test(spec)) return null;
  return slash(path.normalize(path.join(path.dirname(from), spec))).replace(/^\.\//, '');
};
for (const [from, text] of texts) {
  const patterns = [
    /(?:src|href)=["']([^"'#?]+\.(?:js|mjs|css|html))(?:[?#][^"']*)?["']/gi,
    /["']((?:\.\.\/|\.\/)[^"']+\.(?:js|mjs|css|html))(?:[?#][^"']*)?["']/gi,
    /loadBogatkaPatch\(\s*["'](?:script|link)["']\s*,\s*\{[^}]*?(?:src|href)\s*:\s*["']([^"']+)["']/gis,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const target = resolveSpec(from, match[1]);
      if (target) addEdge(from, target);
    }
  }
}

const swText = texts.get('sw-v340.js') || '';
const swAssets = new Set([...swText.matchAll(/["']\.\/([^"']+)["']/g)].map(match => match[1]));
const entrypoints = new Set(['index.html', 'report/index.html', 'reset/index.html']);
const reachable = new Set(entrypoints);
const queue = [...entrypoints];
while (queue.length) {
  const current = queue.shift();
  for (const target of loads.get(current) || []) {
    if (!reachable.has(target)) { reachable.add(target); queue.push(target); }
  }
}

const dataKeys = ['checklist','score','traffic','trafficMeasurements','competitor','competitors','tech','economics','criticalDealConditions','stopFactors','comments','tasks','history','decision','launchProject','status','rent','rentConditions','objectType','object_type','premiseAvailability','landlordReadiness','contactRole','archivedAt','deletedTaskIds','deletedCommentIds','client_id','revision','tombstone'];
const compatibilityRules = [
  ['legacy status mapping', ['normalizeStatus', 'legacy status']],
  ['legacy rent preservation', ['rentToTech', 'rentConditions', 'data?.rent', 'data.rent']],
  ['legacy checklist booleans', ['legacy boolean', "typeof value==='boolean'", 'checklist']],
  ['legacy lease checks', ['stopFactors', 'criticalDealConditions']],
  ['legacy traffic/competitors', ['trafficMeasurements', 'competitors', 'legacy-traffic']],
  ['legacy opening milestones', ['launchProject', 'milestones', 'schemaVersion']],
  ['field-wise sync / tombstones', ['tombstone', 'deletedTaskIds', 'deletedCommentIds']],
];
const activeBase = new Set(['index.html','style.css','v21.css','v22.css','v23.css','cloud.css','premium-v30.css','core.js','ui-v2.js','location-v2.js','report-v2.js','report-v22.js','v21.js','v22.js','v23.js','cloud.js','premium-v30.js','config.js','supabase-config.js','sw.js','sw-v340.js']);
const compatibilityName = /(compat|stability|persistence|integrity|normalize|durable|sync-field|object-type-reset|report-live-fixes|auth-signup-fix|score-guide-fix|backup-import|viewer-extra|address-fix)/i;
const accidentalNames = new Set(['THIS_SHOULD_NOT_EXIST']);
const globalsFor = text => [...new Set([
  ...[...text.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(match => match[1]),
  ...[...text.matchAll(/window\[\s*["']([^"']+)["']\s*\]\s*=/g)].map(match => match[1]),
])].sort();
const functionsFor = text => [...new Set([
  ...[...text.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]),
  ...[...text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)].map(match => match[1]),
])].sort().slice(0, 30);
const wrapperFacts = text => {
  const result = [];
  if (text.includes('__base')) result.push('__base wrapper chain');
  if (/\b(?:const|let)\s+base\w*\s*=/.test(text)) result.push('captures base implementation');
  if (text.includes('MutationObserver')) result.push('MutationObserver installer');
  if (/\b(?:getLocationData|idbPut|idbDelete|renderLocations|updateSummary|buildReportHtml|cloudInit|cloudSyncAll)\s*=/.test(text)) result.push('replaces/wraps public runtime function');
  if (text.includes('setTimeout') && /install|retry/i.test(text)) result.push('delayed installer/retry');
  return result;
};
const purposeFor = file => {
  const stem = path.basename(file, path.extname(file)).replaceAll('-', ' ');
  if (file === 'index.html') return 'Main PWA document and direct asset loader.';
  if (file === 'v23.js') return 'Primary dynamic loader plus compatibility installers.';
  if (file === 'sw-v340.js') return 'Service Worker cache manifest and offline fetch strategy.';
  if (file.startsWith('tests/')) return `Regression/static verification for ${stem}.`;
  if (file.startsWith('report/')) return `Standalone/public report component for ${stem}.`;
  if (file.startsWith('reset/')) return `Password recovery component for ${stem}.`;
  if (file.endsWith('.css')) return `Runtime styles for ${stem}.`;
  if (/sync|cloud/i.test(file)) return `Local-first/cloud synchronization component: ${stem}.`;
  if (/report/i.test(file)) return `Main-app report component: ${stem}.`;
  if (/backup/i.test(file)) return `Backup/restore component: ${stem}.`;
  return `Runtime component for ${stem}.`;
};

const testTexts = [...texts].filter(([file]) => file.startsWith('tests/'));
const inventory = files.map(absolute => {
  const file = rel(absolute);
  const text = texts.get(file);
  const globals = globalsFor(text);
  const tokens = [path.basename(file), path.basename(file, path.extname(file)), ...globals].filter(Boolean);
  const tests = testTexts.filter(([testFile, testText]) => testFile !== file && tokens.some(token => testText.includes(token))).map(([testFile]) => testFile).sort();
  const loadedBy = [...(references.get(file) || [])].sort();
  const savedData = dataKeys.filter(key => new RegExp(`(?<![\\w])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(text));
  const legacy = compatibilityRules.filter(([, markers]) => markers.some(marker => text.toLowerCase().includes(marker.toLowerCase()))).map(([name]) => name);
  let classification;
  if (file.startsWith('tests/') || file.endsWith('.mjs')) classification = 'TEST_ONLY';
  else if (file.startsWith('report/')) classification = 'REPORT_ONLY';
  else if (file.startsWith('reset/')) classification = 'RESET_ONLY';
  else if (accidentalNames.has(file)) classification = 'ACCIDENTAL';
  else if (activeBase.has(file)) classification = 'ACTIVE_BASE';
  else if (compatibilityName.test(file) && (reachable.has(file) || observed.has(file) || swAssets.has(file))) classification = 'COMPATIBILITY_REQUIRED';
  else if (reachable.has(file) || observed.has(file)) classification = 'ACTIVE_CANONICAL';
  else if (loadedBy.length || swAssets.has(file) || tests.length || savedData.length || legacy.length) classification = 'UNKNOWN_BLOCKED';
  else classification = 'ORPHAN_CONFIRMED';
  return {
    path: file,
    type: path.extname(file).slice(1),
    size_bytes: fs.statSync(absolute).size,
    purpose: purposeFor(file),
    loaded_by: loadedBy,
    loads: [...(loads.get(file) || [])].sort(),
    runtime_consumers: loadedBy.filter(value => !value.startsWith('tests/') && !value.startsWith('report/') && !value.startsWith('reset/')),
    report_consumers: loadedBy.filter(value => value.startsWith('report/') || path.basename(value).includes('report')),
    service_worker_cached: swAssets.has(file),
    observed_requested_in_full_suite: observed.has(file),
    wrappers_installed: wrapperFacts(text),
    globals_exported: globals,
    unique_logic: functionsFor(text),
    saved_data_dependencies: savedData,
    legacy_compatibility_responsibility: legacy,
    tests_covering: tests,
    classification,
  };
});

const classifications = ['ACTIVE_CANONICAL','ACTIVE_BASE','COMPATIBILITY_REQUIRED','MERGE_INTO_CANONICAL','TEST_ONLY','REPORT_ONLY','RESET_ONLY','ORPHAN_CONFIRMED','ACCIDENTAL','UNKNOWN_BLOCKED'];
const totals = Object.fromEntries(classifications.map(name => [name, inventory.filter(item => item.classification === name).length]));
const runtimeJs = inventory.filter(item => item.type === 'js' && item.observed_requested_in_full_suite && !item.path.startsWith('report/') && !item.path.startsWith('reset/')).length;
const runtimeCss = inventory.filter(item => item.type === 'css' && item.observed_requested_in_full_suite && !item.path.startsWith('report/') && !item.path.startsWith('reset/')).length;
const result = {
  generated_at: new Date().toISOString(),
  source: 'static graph + complete browser-suite request evidence',
  summary: {file_count: inventory.length, classification_totals: totals, observed_main_runtime_js_count: runtimeJs, observed_main_runtime_css_count: runtimeCss, service_worker_asset_count: swAssets.size},
  files: inventory,
};
const json = `${JSON.stringify(result, null, 2)}\n`;
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const md = [
  '# Bogatka dependency and loader inventory', '',
  `Files inventoried: **${inventory.length}**.`, '',
  `Observed main-runtime JavaScript requests: **${runtimeJs}**.`,
  `Observed main-runtime CSS requests: **${runtimeCss}**.`,
  `Service Worker asset entries: **${swAssets.size}**.`, '',
  '## Classification totals', '',
  ...classifications.map(name => `- \`${name}\`: ${totals[name]}`), '',
  '## Rules', '',
  '- `UNKNOWN_BLOCKED` is never eligible for deletion.',
  '- A confirmed orphan has no loader, dynamic reference, Service Worker entry, observed request, report/reset consumer, test dependency, saved-data responsibility, or unique compatibility responsibility.',
  '- Version-like filenames are not deletion evidence.', '',
  '## Complete file inventory', '',
  '| Path | Bytes | Loaded by / runtime evidence | SW | Globals / wrappers | Data / compatibility | Tests | Classification |',
  '|---|---:|---|:---:|---|---|---|---|',
  ...inventory.map(item => {
    const evidence = [...item.loaded_by.slice(0, 4), ...(item.observed_requested_in_full_suite ? ['requested'] : [])].join(', ') || 'none';
    const globals = [...item.globals_exported.slice(0, 3), ...item.wrappers_installed.slice(0, 2)].join('; ') || 'none';
    const data = [...item.saved_data_dependencies.slice(0, 5), ...item.legacy_compatibility_responsibility.slice(0, 2)].join('; ') || 'none';
    const tests = `${item.tests_covering.slice(0, 3).join(', ')}${item.tests_covering.length > 3 ? '…' : ''}` || 'none';
    return `| \`${escape(item.path)}\` | ${item.size_bytes} | ${escape(evidence)} | ${item.service_worker_cached ? 'yes' : 'no'} | ${escape(globals)} | ${escape(data)} | ${escape(tests)} | \`${item.classification}\` |`;
  }), '',
].join('\n');

fs.mkdirSync(path.dirname(outputJson), {recursive: true});
fs.writeFileSync(outputJson, json);

if (check) {
  const existingMd = fs.existsSync(outputMd) ? fs.readFileSync(outputMd, 'utf8') : '';
  if (existingMd !== md) {
    console.error('Dependency inventory summary is stale. Run: node bogatka-field-8f3c7d/tests/generate-dependency-inventory.mjs');
    process.exit(1);
  }
} else {
  fs.mkdirSync(path.dirname(outputMd), {recursive: true});
  fs.writeFileSync(outputMd, md);
}
console.log(JSON.stringify({...result.summary, json_output: outputJson}));
