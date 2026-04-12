import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

/** 历史路径：与顶栏「总览」统一为 /admin */
export default async function AdminConfigLegacyPage() {
  const locale = await getLocale();
  redirect({ href: "/admin", locale });
}
