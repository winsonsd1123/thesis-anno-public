"use client";

import type { CSSProperties, MouseEvent } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { C } from "./constants";

type FooterItem = { key: string; label: string };

function resolveFooterHref(
  key: string,
  locale: string,
  contactEmail: string | undefined
): { mode: "next"; href: string } | { mode: "anchor"; href: string } | null {
  const home = `/${locale}`;
  switch (key) {
    case "features":
      return { mode: "anchor", href: `${home}#features` };
    case "workflow":
      return { mode: "anchor", href: `${home}#workflow` };
    case "pricing":
      return { mode: "anchor", href: `${home}#pricing` };
    case "sampleReport":
      return { mode: "next", href: "/sample-report" };
    case "docs":
      return { mode: "next", href: "/docs" };
    case "gradingStandards":
      return { mode: "next", href: "/grading-standards" };
    case "about":
      return { mode: "next", href: "/about" };
    case "contact":
      if (contactEmail) return { mode: "anchor", href: `mailto:${contactEmail}` };
      return { mode: "anchor", href: `${home}/about#contact` };
    case "privacy":
      return { mode: "next", href: "/privacy" };
    case "terms":
      return { mode: "next", href: "/terms" };
    default:
      return null;
  }
}

export function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined;

  const footerColumns: { title: string; items: FooterItem[] }[] = [
    { title: t("product"), items: t.raw("productItems") as FooterItem[] },
    { title: t("resources"), items: t.raw("resourceItems") as FooterItem[] },
    { title: t("about"), items: t.raw("aboutItems") as FooterItem[] },
  ];

  const linkStyle: CSSProperties = {
    fontSize: 13,
    color: C.textSecondary,
    textDecoration: "none",
    transition: "color 0.2s",
  };

  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: "48px 32px 32px", background: C.surface }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="footer-grid" style={{ marginBottom: 44 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${C.brand}, ${C.teal})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ✦
              </div>
              <span
                style={{
                  fontFamily: "inherit",
                  fontWeight: 800,
                  fontSize: 16,
                  color: C.textPrimary,
                }}
              >
                ThesisAI
              </span>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.65, maxWidth: 260 }}>
              {t("slogan")}
            </p>
          </div>

          {footerColumns.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.textMuted,
                  letterSpacing: "0.8px",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                {col.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.items.map((item) => {
                  const resolved = resolveFooterHref(item.key, locale, contactEmail);
                  if (!resolved) return null;
                  const onEnter = (e: MouseEvent<HTMLElement>) => {
                    (e.currentTarget as HTMLElement).style.color = C.brand;
                  };
                  const onLeave = (e: MouseEvent<HTMLElement>) => {
                    (e.currentTarget as HTMLElement).style.color = C.textSecondary;
                  };
                  if (resolved.mode === "next") {
                    return (
                      <Link
                        key={item.key}
                        href={resolved.href}
                        style={linkStyle}
                        onMouseEnter={onEnter}
                        onMouseLeave={onLeave}
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <a
                      key={item.key}
                      href={resolved.href}
                      rel={resolved.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                      style={linkStyle}
                      onMouseEnter={onEnter}
                      onMouseLeave={onLeave}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="divider" style={{ marginBottom: 22 }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{t("copyright")}</span>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(t.raw("socialLabels") as string[]).map((p) => (
              <span key={p} style={{ fontSize: 12, color: C.textMuted }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
