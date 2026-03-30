-- 用户站内信：管理员发信、用户收件箱（RLS）；插入与列表查询走 service_role。
-- 依赖：gen_random_uuid()（pgcrypto，Supabase 默认可用）

create table if not exists public.user_inbox_messages (
  id uuid not null default gen_random_uuid() primary key,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  recipient_email_snapshot text not null,
  sender_display_name text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_admin_id uuid references auth.users (id) on delete set null
);

create index if not exists user_inbox_messages_recipient_idx
  on public.user_inbox_messages (recipient_user_id);

create index if not exists user_inbox_messages_created_idx
  on public.user_inbox_messages (created_at desc);

create index if not exists user_inbox_messages_email_idx
  on public.user_inbox_messages (recipient_email_snapshot text_pattern_ops);

create index if not exists user_inbox_messages_unread_idx
  on public.user_inbox_messages (recipient_user_id)
  where read_at is null;

alter table public.user_inbox_messages enable row level security;

create policy "user_inbox_select_own"
  on public.user_inbox_messages
  for select
  to authenticated
  using (auth.uid() = recipient_user_id);

create policy "user_inbox_update_own"
  on public.user_inbox_messages
  for update
  to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- 按邮箱解析 auth.users.id；仅 service_role 可调用（供服务端发信）
create or replace function public.admin_lookup_user_id_by_email(candidate_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(trim(email)) = lower(trim(candidate_email))
  limit 1;
$$;

revoke all on function public.admin_lookup_user_id_by_email(text) from public;
grant execute on function public.admin_lookup_user_id_by_email(text) to service_role;

comment on table public.user_inbox_messages is '管理员发给用户的站内信；插入仅 service_role。';
