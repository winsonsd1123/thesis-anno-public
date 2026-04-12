"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/app/components/LocaleSwitcher";
import { DashboardEduGrantNavLink } from "./DashboardEduGrantNavLink";
import { SignOutButton } from "./SignOutButton";
import styles from "./DashboardTopBar.module.css";

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Props = {
  isAdmin: boolean;
  grantWindowOpen: boolean;
  grantNavEmphasized: boolean;
  inboxUnread: number;
  userEmail: string;
};

export function DashboardTopBar({
  isAdmin,
  grantWindowOpen,
  grantNavEmphasized,
  inboxUnread,
  userEmail,
}: Props) {
  const pathname = usePathname();
  const t = useTranslations("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryNav: { href: string; labelKey: "home" | "billing" | "transactions" | "settings" | "messagesNav" }[] =
    [
      { href: "/dashboard", labelKey: "home" },
      { href: "/dashboard/billing", labelKey: "billing" },
      { href: "/dashboard/transactions", labelKey: "transactions" },
      { href: "/dashboard/settings", labelKey: "settings" },
      { href: "/dashboard/messages", labelKey: "messagesNav" },
    ];

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setMenuOpen(false);
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.bar} role="banner">
        <div className={styles.leftCluster}>
          <Link href="/dashboard" className={styles.brand} aria-label="ThesisAI">
            <span className={styles.brandMark} aria-hidden>
              ✦
            </span>
            <span className={styles.brandText}>ThesisAI</span>
          </Link>

          <span className={styles.clusterRule} aria-hidden />

          <div className={styles.desktopWorkstrip}>
            <nav className={styles.primaryNav} aria-label={t("topBar.navAria")}>
              {primaryNav.map(({ href, labelKey }) => {
                const active = isNavActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(styles.navLink, active && styles.navLinkActive)}
                  >
                    {t(labelKey)}
                    {labelKey === "messagesNav" && inboxUnread > 0 ? (
                      <span className={styles.badgeUnread} title={String(inboxUnread)}>
                        {inboxUnread > 99 ? "99+" : inboxUnread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {(grantWindowOpen || isAdmin) && <span className={styles.clusterRuleMuted} aria-hidden />}

            <div className={styles.actions}>
              {grantWindowOpen ? <DashboardEduGrantNavLink emphasized={grantNavEmphasized} /> : null}
              {isAdmin ? (
                <Link href="/admin" className={styles.adminLink}>
                  {t("admin")}
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className={styles.localeWrap}>
            <LocaleSwitcher compact />
          </div>
          <Link href="/dashboard/settings" className={styles.userEmail} title={userEmail}>
            {userEmail}
          </Link>
          <Link href="/" className={styles.backHome}>
            {t("backToHome")}
          </Link>
          <SignOutButton className={styles.signOut} />
          <button
            type="button"
            className={clsx(styles.menuBtn, menuOpen && styles.menuOpen)}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="dashboard-nav-drawer"
            aria-label={menuOpen ? t("topBar.menuClose") : t("topBar.menuOpen")}
          >
            <span className={styles.menuIcon} aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      <div
        id="dashboard-nav-drawer"
        className={clsx(styles.drawer, menuOpen && styles.drawerOpen)}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className={styles.drawerBackdrop}
          aria-label={t("topBar.menuClose")}
          onClick={() => setMenuOpen(false)}
        />
        <div className={styles.drawerPanel} role="dialog" aria-modal="true" aria-label={t("topBar.navAria")}>
          <div className={styles.drawerSectionLabel}>{t("topBar.sectionWorkspace")}</div>
          {primaryNav.map(({ href, labelKey }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(styles.drawerLink, active && styles.drawerLinkActive)}
                onClick={() => setMenuOpen(false)}
              >
                <span>{t(labelKey)}</span>
                {labelKey === "messagesNav" && inboxUnread > 0 ? (
                  <span className={styles.badgeUnread}>{inboxUnread > 99 ? "99+" : inboxUnread}</span>
                ) : null}
              </Link>
            );
          })}

          {(grantWindowOpen || isAdmin) && (
            <div className={styles.drawerActions}>
              <div className={styles.drawerSectionLabel}>{t("topBar.sectionActions")}</div>
              <div className={styles.drawerRow}>
                {grantWindowOpen ? <DashboardEduGrantNavLink emphasized={grantNavEmphasized} /> : null}
              </div>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={clsx(styles.adminLink, styles.drawerAdminLink)}
                  onClick={() => setMenuOpen(false)}
                >
                  {t("admin")}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
