-- 工单列表管理端：按邮箱子串筛选（快照，插入时由应用写入）
alter table public.support_tickets
  add column if not exists reporter_email text;

comment on column public.support_tickets.reporter_email is
  '创建工单时从 auth 同步的用户邮箱快照，供管理端筛选；历史行可能为空。';
