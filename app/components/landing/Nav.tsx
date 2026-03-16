"use client";

import { useState, useEffect } from "react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { C } from "./constants";
import { createClient } from "@/lib/supabase/client";

export function Nav() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsLoggedIn(!!data?.user));
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "0 32px",
        transition: "all 0.3s ease",
        background: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0)",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${C.brand}, ${C.teal})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✦
          </div>
          <span
            style={{
              fontFamily: "Sora, sans-serif",
              fontWeight: 800,
              fontSize: 17,
              color: C.textPrimary,
              letterSpacing: "-0.4px",
            }}
          >
            ThesisAI
          </span>
        </div>

        <div className="nav-links" style={{ alignItems: "center" }}>
          {[
            { label: t("features"), href: "#features" },
            { label: t("workflow"), href: "#workflow" },
            { label: t("pricing"), href: "#pricing" },
            { label: t("faq"), href: "#faq" },
          ].map((item) => (
            <a key={item.label} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["zh", "en"] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => router.replace(pathname, { locale: loc })}
                style={{
                  padding: "4px 10px",
                  fontSize: 13,
                  fontWeight: locale === loc ? 600 : 400,
                  color: locale === loc ? C.brand : C.textMuted,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 6,
                }}
              >
                {loc === "zh" ? "中文" : "EN"}
              </button>
            ))}
          </div>
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn-primary" style={{ padding: "9px 20px", fontSize: 14, textDecoration: "none" }}>
              {t("dashboard")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost" style={{ padding: "8px 18px", fontSize: 14, textDecoration: "none" }}>
                {t("login")}
              </Link>
              <Link href="/register" className="btn-primary" style={{ padding: "9px 20px", fontSize: 14, textDecoration: "none" }}>
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
