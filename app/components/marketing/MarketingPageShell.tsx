import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { C } from "@/app/components/landing/constants";

export type MarketingSection = { title: string; body: string };

export function MarketingSections({ sections }: { sections: MarketingSection[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: C.textPrimary }}>{s.title}</h2>
          <p style={{ color: C.textSecondary, lineHeight: 1.75, whiteSpace: "pre-line" }}>{s.body}</p>
        </section>
      ))}
    </>
  );
}

export function MarketingPageShell({ children, backLabel }: { children: ReactNode; backLabel: string }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.textPrimary, padding: "48px 24px 80px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/"
          style={{
            fontSize: 14,
            color: C.brand,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 28,
          }}
        >
          ← {backLabel}
        </Link>
        {children}
      </div>
    </div>
  );
}
