import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function AdminIndexPage() {
  const locale = await getLocale();
  redirect({ href: "/admin/config", locale });
}
