-- Applied via Supabase migration `reviews_domain_thesis_pdfs_bucket_realtime` (reference copy)
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS domain text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thesis-pdfs',
  'thesis-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
