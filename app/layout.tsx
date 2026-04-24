import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "ThesisAI · AI 驱动的论文智能批阅平台",
  description:
    "多智能体协作批阅，格式规范、内容逻辑、参考文献三维并行审查，5 分钟内出具导师级预审报告。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
