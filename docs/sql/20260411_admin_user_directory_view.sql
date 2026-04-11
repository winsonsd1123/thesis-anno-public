-- 管理端用户列表视图：联接 auth.users 与 profiles，供 service_role 查询。
-- 用于替代 auth.admin.listUsers（部分 Supabase/Auth 版本下 listUsers 返回 Database error finding users）。
--
-- 在 Supabase SQL Editor 执行，或通过 MCP apply_migration。

create or replace view public.admin_user_directory as
select
  u.id,
  u.email::text as email,
  u.last_sign_in_at,
  u.created_at as auth_created_at,
  p.full_name,
  p.avatar_url,
  p.role,
  p.is_disabled,
  p.created_at as profile_created_at
from auth.users u
inner join public.profiles p on p.id = u.id;

comment on view public.admin_user_directory is 'Admin-only user directory (auth + profiles); SELECT granted to service_role only.';

revoke all on public.admin_user_directory from public;
revoke all on public.admin_user_directory from anon, authenticated;
grant select on public.admin_user_directory to service_role;
