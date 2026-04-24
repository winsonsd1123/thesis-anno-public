import { getSiteUrl } from "@/lib/site-url";

const DESCRIPTIONS: Record<string, string> = {
  zh: "多智能体协作批阅 Word 论文：格式、逻辑、参考文献与 AI 痕迹等维度并行审查，生成结构化预审报告；点数计费，定价以应用内为准。",
  en: "Multi-agent Word thesis review: format, logic, references, and AI-trace checks in parallel, producing structured pre-review reports. Credit-based pricing; see in-app for tiers.",
};

export function buildSeoJsonLd(locale: string): string {
  const base = getSiteUrl();
  const description = DESCRIPTIONS[locale] ?? DESCRIPTIONS.en;
  const inLanguage = locale === "zh" ? "zh-CN" : "en";

  const graph = [
    {
      "@type": "Organization",
      "@id": `${base}/#organization`,
      name: "ThesisAI",
      url: base,
    },
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      url: base,
      name: "ThesisAI",
      inLanguage,
      publisher: { "@id": `${base}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "ThesisAI",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description,
      url: base,
      inLanguage,
      publisher: { "@id": `${base}/#organization` },
      offers: {
        "@type": "Offer",
        description: locale === "zh" ? "点数计费，阶梯与套餐以应用内展示为准。" : "Credit-based tiers and packages as shown in-app.",
      },
    },
  ];

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}
