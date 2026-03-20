# Admin Config 模块 - 工作记录

**日期**: 2026-03-17  
**依据**: [Tech_Spec_Admin_Config_v1.0.md](../docs/Tech_Spec_Admin_Config_v1.0.md)

---

## 一、初始开发（完成）

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

---

## 二、迭代与修复

### 2.1 管理员账号设置
- **问题**：管理后台入口不显示
- **原因**：`profiles.role` 未设为 `admin`
- **处理**：将 `17403933@qq.com` 的 `role` 更新为 `admin`

### 2.2 首页计费价格不更新
- **问题**：修改计费配置后，首页 Pricing 仍显示旧价格（如 ¥9.9）
- **原因**：首页 `Pricing` 组件使用硬编码价格，未从 ConfigService 读取
- **处理**：
  - 将 `app/[locale]/page.tsx` 改为 Server Component，调用 `getPackages()` 获取套餐
  - 新增 `HomeContent.tsx` 客户端组件，接收 `packages` 并传给 `Pricing`
  - 修改 `app/components/landing/Pricing.tsx`，接收 `packages` 参数，按 `price`（分）动态展示价格

### 2.3 配置缓存未及时失效
- **问题**：Admin 修改配置后，前端仍读取旧缓存
- **原因**：`revalidateTag(key, "max")` 使用 stale-while-revalidate，会先返回旧数据
- **处理**：改为 `revalidateTag(key, { expire: 0 })`，实现立即失效，下次请求从 Storage 拉取最新配置

### 2.4 套餐选择与支付流程 UX
- **问题**：点击按钮直接跳转支付，缺少「选择→确认」两步；标准套餐与已选套餐同时高亮；未选中时 popular 仍显示「立即购买」
- **处理**：
  - **Dashboard 充值页** (`/dashboard/billing`)：
    - 新增 `BillingPlanSelector` 管理 `selectedPkgId`，`PricingCard` 支持 `selected`、`hasAnySelection`、`onSelect`
    - 第一次点击：选中套餐，按钮文案变为「确认支付」
    - 第二次点击：发起订单并跳转支付
    - 高亮逻辑：`isHighlighted = selected || (popular && !hasAnySelection)`，仅一张卡片高亮
    - 未选中时统一显示「选择此套餐」，不再区分 popular
  - **落地页** (`#pricing`)：
    - 同步选择/高亮逻辑，仅一张卡片高亮
    - 未选中显示「选择此套餐」，选中显示「去充值」
    - 点击已选中卡片的按钮：跳转 `/dashboard/billing`
  - 新增 i18n：`billing.confirmPay`、`landing.pricing.goToRecharge`

---

## 三、使用说明

1. **首次部署**：执行 `npm run init-config` 创建 bucket 并上传默认配置
2. **设置 Admin**：在 Supabase `profiles` 表中将目标用户的 `role` 设为 `admin`
3. **访问**：登录后访问 `/admin/config` 或从 Dashboard 点击「管理后台」
4. **配置生效**：Admin 保存后，缓存立即失效，刷新页面即可看到新配置
