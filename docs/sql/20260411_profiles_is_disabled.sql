-- profiles：应用层禁用标记（中间件拦截 dashboard / admin）
-- 已在 Supabase 项目通过 MCP 迁移 apply_migration(add_profiles_is_disabled) 应用。

alter table public.profiles
  add column if not exists is_disabled boolean not null default false;

comment on column public.profiles.is_disabled is
  'When true, app middleware blocks dashboard/admin until session cleared.';
