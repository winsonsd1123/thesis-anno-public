-- Reference: applied via Supabase MCP migration `reviews_rename_page_count_to_word_count`
ALTER TABLE public.reviews RENAME COLUMN page_count TO word_count;
COMMENT ON COLUMN public.reviews.word_count IS '论文字数（计费核对，服务端统计）';
