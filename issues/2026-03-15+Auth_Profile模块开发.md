# Auth Profile 模块开发 - 完成记录

**日期**: 2026-03-15  
**依据**: [Tech_Spec_Auth_v1.0.md](../docs/Tech_Spec_Auth_v1.0.md)

## 完成内容

### Phase 1: 基础框架
- [x] Supabase SSR: `lib/supabase/server.ts`, `client.ts`, `middleware.ts`
- [x] `middleware.ts`: Session 刷新 + 路由守卫
- [x] 三层架构: `lib/dal`, `lib/services`, `lib/actions`, `lib/dtos`, `lib/schemas`
- [x] `.env.example`

### Phase 2: 认证功能
- [x] `lib/schemas/auth.schema.ts`: Zod 校验
- [x] `lib/dal/auth.dal.ts`, `lib/services/auth.service.ts`
- [x] `lib/actions/auth.actions.ts`: signUp, signIn, OAuth, signOut, resetPassword, updatePassword
- [x] `app/auth/callback/route.ts`
- [x] 认证页: login, register, verify-email, forgot-password, update-password

### Phase 3: 用户档案
- [x] `lib/dtos/user.dto.ts`, `lib/dal/profile.dal.ts`, `lib/services/user.service.ts`
- [x] `lib/schemas/profile.schema.ts`, `lib/actions/profile.actions.ts`
- [x] Dashboard 布局、首页、settings 页
- [x] `app/components/profile/AvatarUpload.tsx`

### Phase 4: 集成
- [x] Nav 登录/注册/控制台链接
- [x] 已登录态显示控制台入口
- [x] Zod v4 错误格式修复 (`issues` 替代 `errors`)

### 后续修复
- [x] **NEXT_REDIRECT 错误**: Server Action 中 `redirect()` 在 try-catch 内抛出被捕获，导致注册/登录成功后显示 "Error: NEXT_REDIRECT"。通过 `isRedirectError()` 识别并重新抛出，使 Next.js 正常执行重定向。

## 前置条件

1. 配置 `.env` 中的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. 在 Supabase 创建 `avatars` Storage bucket（public 读权限）
3. 确认数据库已有 `profiles`、`user_wallets` 表及 `handle_new_user` 触发器
