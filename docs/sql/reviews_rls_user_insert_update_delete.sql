-- Applied via Supabase migration: reviews_rls_user_insert_update_delete
-- 用户 JWT 下的 INSERT/UPDATE/DELETE 与 Service Role 分离；用户端 DAL 使用 createClient()。

CREATE POLICY "Users can insert own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
