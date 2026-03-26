-- Reference: applied via Supabase migration `reviews_format_guidelines`
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS format_guidelines text,
  ADD COLUMN IF NOT EXISTS format_physical_extract jsonb;

COMMENT ON COLUMN public.reviews.format_guidelines IS '自然语言格式要求（格式审阅必选时非空）；语义轨与抽取轨共用';
COMMENT ON COLUMN public.reviews.format_physical_extract IS '可选：缓存 NL→JSON 抽取结果（调试/复跑）';
