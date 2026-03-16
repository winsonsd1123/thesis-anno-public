# 用户认证与档案模块技术方案 (Tech Spec) v1.0

| 版本 | 日期 | 作者 | 状态 |
| :--- | :--- | :--- | :--- |
| v1.0 | 2026-03-15 | Colin | Draft |

## 1. 概述 (Overview)

本方案旨在细化 PRD v2.0 第 5.1 节 "用户认证模块"，并基于现有的数据库设计 (`profiles` 表与触发器)，明确前端与后端的实现细节。我们将采用 **Next.js App Router (Server Actions)** 结合 **Supabase Auth**，并严格遵循 **三层架构 (3-Tier Architecture)** 原则，确保代码的可维护性与扩展性。

### 1.1 核心功能范围
1.  **注册 (Sign Up)**: 邮箱密码注册（带邮箱验证）、OAuth (Google/GitHub)。
2.  **登录 (Sign In)**: 邮箱密码登录、OAuth 登录。
3.  **会话管理 (Session)**: 基于 Cookie 的持久化会话，中间件路由保护。
4.  **个人档案 (Profile)**: 查看与更新用户资料（头像、昵称）。
5.  **密码重置 (Reset Password)**: 找回密码流程。

---

## 2. 架构设计 (Architecture)

为满足 "三层架构" 要求，我们在 Next.js App Router 中定义如下分层：

### 2.1 分层定义

| 层级 | 职责 | 对应文件/目录 |
| :--- | :--- | :--- |
| **1. 表现层 (Presentation Layer)** | - **UI 组件**: 负责页面渲染、表单交互、Loading 状态。<br>- **Server Actions**: 作为控制器 (Controller)，接收前端请求，进行输入验证 (Zod)，调用业务层，返回结果给 UI。 | `app/(auth)/*`<br>`app/dashboard/profile/*`<br>`lib/actions/*` |
| **2. 业务逻辑层 (Business Logic Layer)** | - **Service**: 封装核心业务规则。例如：用户注册后的初始化逻辑、更新资料前的权限校验、数据清洗。<br>- **DTO (Data Transfer Object)**: 定义层间数据传输的类型。 | `lib/services/*`<br>`lib/dtos/*` |
| **3. 数据访问层 (Data Access Layer)** | - **DAL (Data Access Layer)**: 直接与数据库 (Supabase) 交互。负责执行 SQL/Supabase Query，处理数据库错误，返回纯净的数据实体。<br>- **Repository**: (可选) 如果逻辑复杂，可进一步抽象。 | `lib/dal/*`<br>`lib/supabase/*` |

### 2.2 数据流向 (Data Flow)

**用户更新资料场景：**
1.  **Client (UI)**: 用户填写表单 -> 点击保存 -> 调用 Server Action `updateProfile(formData)`.
2.  **Presentation (Action)**: `updateProfile` 验证 `formData` 格式 (Zod) -> 调用 Service `userService.updateProfile(userId, data)`.
3.  **Business Logic (Service)**: `userService` 检查业务规则 (如：昵称是否违禁) -> 调用 DAL `profileDAL.update(userId, data)`.
4.  **Data Access (DAL)**: `profileDAL` 构建 Supabase Query -> 执行 `supabase.from('profiles').update(...)` -> 返回结果.
5.  **Return**: 结果逐层返回，UI 弹出 Toast 提示成功。

---

## 3. 数据库与数据模型 (Data Model)

基于已有的数据库设计 (`docs/AI_Thesis_Review_Database_Schema.md`)，我们直接使用以下表：

### 3.1 核心表引用
*   **`auth.users`**: Supabase 托管，存储 UID, Email, Password Hash, Last Sign In。
*   **`public.profiles`**: 用户扩展信息。
    *   `id` (FK -> auth.users.id)
    *   `full_name`
    *   `avatar_url`
    *   `role`
*   **`public.user_wallets`**: 用户积分钱包 (注册时自动创建)。

### 3.2 关键触发器 (Existing)
*   `handle_new_user`: 监听 `auth.users` INSERT，自动初始化 `profiles` 和 `user_wallets`。**这意味着业务层无需手动创建 Profile。**

---

## 4. 详细设计 (Detailed Design)

### 4.1 认证流程 (Authentication)

#### 4.1.1 注册与登录
*   **技术栈**: Supabase SSR (`@supabase/ssr`).
*   **交互**: 使用 Server Actions 处理表单提交。
*   **OAuth**: 
    *   调用 `supabase.auth.signInWithOAuth`.
    *   回调路由 `/auth/callback` 处理 Code Exchange，设置 Cookie。

#### 4.1.2 中间件 (Middleware)
*   **文件**: `middleware.ts`
*   **职责**:
    1.  **刷新 Session**: 必须调用 `supabase.auth.getUser()` 以刷新 Auth Token（Supabase 机制要求）。
    2.  **路由保护**:
        *   未登录访问 `/dashboard/*` -> 重定向至 `/login`.
        *   已登录访问 `/login`, `/register` -> 重定向至 `/dashboard`.

#### 4.1.3 邮箱激活 (Email Verification)
*   **注册参数**: `signUp` 时设置 `options: { emailRedirectTo: '${origin}/auth/callback' }`。
*   **流程**:
    1.  用户提交注册表单。
    2.  Supabase 发送确认邮件。
    3.  前端跳转至 `/verify-email` (提示 "Check your email")。
    4.  用户点击邮件链接 -> `/auth/callback` -> 交换 Session -> 重定向至 `/dashboard`。

#### 4.1.4 找回密码 (Password Reset)
*   **Stage 1: 发送链接**
    *   页面: `/forgot-password`
    *   Action: `resetPasswordForEmail(email, { redirectTo: '${origin}/auth/callback?next=/update-password' })`
    *   UI: 提交后提示 "Check your email for reset link"。
*   **Stage 2: 重置密码**
    *   链接跳转: 用户点击邮件链接 -> `/auth/callback` (登录态建立) -> 重定向至 `/update-password`。
    *   页面: `/update-password` (需验证登录态)。
    *   Action: `updateUser({ password: newPassword })`。


### 4.2 用户档案管理 (Profile Management)

#### 4.2.1 查询档案 (GET)
*   **场景**: 用户进入设置页面，回显当前信息。
*   **DAL 方法**: `getProfileByUserId(userId: string)`
*   **缓存策略**: 使用 React `cache` 或 Next.js `unstable_cache` 减少数据库读取。

#### 4.2.2 更新档案 (POST)
*   **场景**: 修改昵称或上传头像。
*   **校验**:
    *   `full_name`: 长度 2-50 字符。
    *   `avatar_url`: 必须是合法的 URL (通常来自 Supabase Storage)。
*   **头像上传**:
    1.  前端直传 Supabase Storage (`public-read` bucket).
    2.  获取 URL 后，随表单提交给 Server Action 更新 `profiles` 表。

### 4.3 输入校验规则 (Validation Rules)

我们使用 **Zod** 定义统一的校验 schema，确保前后端规则一致。

*   **Email**: 必须是合法的邮箱格式。
*   **Password**:
    *   长度: 至少 8 位。
    *   复杂性: 必须包含大写字母、小写字母、数字、特殊符号 (如 `!@#$%^&*`) 中的至少三种。
    *   实现:
        ```typescript
        z.string()
         .min(8, 'Password must be at least 8 characters')
         .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
         .regex(/[a-z]/, 'Must contain at least one lowercase letter')
         .regex(/[0-9]/, 'Must contain at least one number')
         .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');
        ```
*   **Full Name**: 2-50 个字符。

---

## 5. 接口定义 (API Interface & Types)

### 5.1 DTO (Data Transfer Objects)

```typescript
// lib/dtos/user.dto.ts

export interface UserProfileDTO {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  createdAt: Date;
}

export interface UpdateProfileDTO {
  fullName?: string;
  avatarUrl?: string;
}
```

### 5.2 DAL 接口 (Data Access Layer)

```typescript
// lib/dal/profile.dal.ts

export const profileDAL = {
  async getById(userId: string): Promise<UserProfileDTO | null> {
    // Supabase query...
  },
  
  async update(userId: string, data: UpdateProfileDTO): Promise<void> {
    // Supabase update...
  }
}
```

---

## 6. 开发计划 (Implementation Plan)

### Phase 1: 基础框架搭建
1.  [ ] **配置 Supabase SSR**: 安装 `@supabase/ssr`，配置环境变量，编写 `createClient` 工具函数 (Server/Client/Middleware)。
2.  [ ] **实现 Middleware**: 处理 Session 刷新和路由守卫。
3.  [ ] **搭建三层架构目录**: 创建 `lib/dal`, `lib/services`, `lib/actions`, `lib/dtos`。

### Phase 2: 认证功能实现
5.  [ ] **实现 Auth Service & DAL**: 封装登录、注册、退出、**重置密码**逻辑。
6.  [ ] **开发 UI 组件**:
    *   登录页 (`/login`)
    *   注册页 (`/register`)
    *   找回密码页 (`/forgot-password`)
    *   重置密码页 (`/update-password`)
7.  [ ] **集成 Server Actions**: 连接 UI 与 Service，处理 OAuth 回调。

### Phase 3: 用户档案功能
7.  [ ] **实现 Profile Service & DAL**: 查询和更新 Profile。
8.  [ ] **开发 Profile 页面**: `/dashboard/settings`，包含头像上传组件。
9.  [ ] **头像上传逻辑**: 集成 Supabase Storage SDK。

### Phase 4: 验证与测试
10. [ ] **单元测试**: 测试 Service 层逻辑。
11. [ ] **集成测试**: 手动验证完整流程（注册 -> 自动跳转 -> 数据库检查 Profile 创建 -> 更新资料）。

---

## 7. 安全注意事项 (Security)
1.  **RLS**: 严格依赖数据库 RLS，DAL 层不要试图绕过 RLS (使用普通 Client 而非 Admin Client)。
2.  **Zod 校验**: 所有 Server Actions 入参必须经 Zod 校验。
3.  **错误处理**: 生产环境隐藏具体数据库错误，仅返回友好提示。
