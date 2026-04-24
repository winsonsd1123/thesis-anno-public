import { buildSeoJsonLd } from "@/lib/seo-jsonld";

type Props = {
  locale: string;
};

export function SeoJsonLd({ locale }: Props) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON-LD requires inline script
      dangerouslySetInnerHTML={{ __html: buildSeoJsonLd(locale) }}
    />
  );
}
