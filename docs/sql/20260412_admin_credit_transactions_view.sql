-- 管理端积分流水视图：联接 credit_transactions 与 admin_user_directory，供 service_role 查询（含用户邮箱）。
-- 在 Supabase SQL Editor 执行，或通过 MCP apply_migration。

create or replace view public.admin_credit_transactions as
select
  ct.id,
  ct.user_id,
  ct.amount,
  ct.balance_before,
  ct.balance_after,
  ct.type,
  ct.reference_id,
  ct.metadata,
  ct.created_at,
  u.email::text as user_email
from public.credit_transactions ct
inner join public.admin_user_directory u on u.id = ct.user_id;

comment on view public.admin_credit_transactions is 'Admin-only credit ledger with user email; SELECT granted to service_role only.';

revoke all on public.admin_credit_transactions from public;
revoke all on public.admin_credit_transactions from anon, authenticated;
grant select on public.admin_credit_transactions to service_role;
