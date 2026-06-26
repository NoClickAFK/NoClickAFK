begin;

drop policy if exists "invited account can view own invite" on public.project_invites;

drop function if exists public.can_accept_project_invite(uuid, text);
drop function if exists public.mark_project_invite_accepted(text);

revoke all on function public.claim_bogatka_project() from public;
revoke all on function public.claim_bogatka_project() from anon;
grant execute on function public.claim_bogatka_project() to authenticated;

revoke all on function public.create_project_invite(uuid, text, text, integer) from public;
revoke all on function public.create_project_invite(uuid, text, text, integer) from anon;
grant execute on function public.create_project_invite(uuid, text, text, integer) to authenticated;

revoke all on function public.revoke_project_invite(uuid) from public;
revoke all on function public.revoke_project_invite(uuid) from anon;
grant execute on function public.revoke_project_invite(uuid) to authenticated;

commit;
