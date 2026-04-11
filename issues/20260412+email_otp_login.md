# 邮箱验证码登录（双轨）

## 上下文

- 在保留邮箱+密码登录的前提下，增加 Supabase 邮箱 OTP：`signInWithOtp`（`shouldCreateUser: false`）+ `verifyOtp`（`type: 'email'`）。
- 入口：登录页切换「使用密码登录」/「使用邮箱验证码登录」。

## 涉及文件

- `lib/dal/auth.dal.ts` — `signInWithEmailOtp`、`verifyEmailOtp`
- `lib/services/auth.service.ts` — `sendEmailLoginOtp`、`verifyEmailLoginOtp`（`emailRedirectTo` 指向 `/auth/callback`）
- `lib/schemas/auth.schema.ts` — `emailOtpSendSchema`、`emailOtpVerifySchema`
- `lib/actions/auth.actions.ts` — `sendEmailLoginOtp`、`verifyEmailLoginOtp` 及错误映射
- `app/[locale]/(auth)/login/page.tsx` — 双模式 UI、发码冷却与验码表单
- `messages/zh.json`、`messages/en.json` — `auth.login`、`auth.loginOtp`

## 运维

- Supabase Dashboard：Authentication → Email，确认 OTP 邮件模板与发信正常。
