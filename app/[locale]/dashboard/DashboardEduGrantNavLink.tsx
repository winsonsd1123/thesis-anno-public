"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type Props = {
  /** 当前用户满足申领按钮展示条件时，使用更强脉冲动效 */
  emphasized: boolean;
};

export function DashboardEduGrantNavLink({ emphasized }: Props) {
  const t = useTranslations("dashboard");
  const cls = emphasized
    ? "edu-grant-nav-link edu-grant-nav-link--strong"
    : "edu-grant-nav-link edu-grant-nav-link--soft";

  return (
    <Link
      href="/dashboard/billing#edu-grant"
      className={cls}
      aria-label={t("eduGrantNavAria")}
    >
      <span className="edu-grant-nav-link__label">{t("eduGrantNav")}</span>
    </Link>
  );
}
