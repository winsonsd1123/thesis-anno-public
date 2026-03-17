# Admin Config 模块开发 - 完成记录

**日期**: 2026-03-17  
**依据**: [Tech_Spec_Admin_Config_v1.0.md](../docs/Tech_Spec_Admin_Config_v1.0.md)

## 已完成内容

### Phase 1: 基础设施
- Supabase Storage Bucket `app-config` (Private)
- 默认配置: `config/prompts.default.json`、`config/system.default.json`，`config/billing.config.json` 作为 billing 初始化源
- `scripts/init-config-storage.ts`：首次部署前执行 `npm run init-config`
- `lib/services/config.service.ts`：ConfigService + Zod Schema + unstable_cache + revalidateTag
- `lib/schemas/config.schemas.ts`：promptsSchema、billingSchema、systemSchema

### Phase 2: 业务集成
- `lib/config/billing.ts`：改为从 ConfigService 读取 Storage，无 fallback
- `lib/services/prompt.service.ts`：PromptManager（getTemplate、getModelConfig、变量替换）
- 更新 billing 调用方：estimate-cost、create-order、billing.actions、billing page

### Phase 3: 管理后台
- `lib/utils/admin.ts`：requireAdmin、getAdminUserOrNull
- `middleware.ts`：/admin 路由需登录
- `app/[locale]/admin/`：layout、config 入口、prompts 列表/编辑、pricing、system
- `app/api/admin/config/{prompts,billing,system}/route.ts`：POST 保存 + revalidateTag
- Dashboard 布局：admin 用户显示「管理后台」入口

## 使用说明

1. **首次部署**：执行 `npm run init-config` 创建 bucket 并上传默认配置
2. **设置 Admin**：在 Supabase `profiles` 表中将目标用户的 `role` 设为 `admin`
3. **访问**：登录后访问 `/admin/config` 或从 Dashboard 点击「管理后台」
