-- Reference copy: applied via Supabase migration `start_review_and_deduct`
-- Atomic: deduct credits, log consumption, set reviews to processing + initial stages

CREATE OR REPLACE FUNCTION public.start_review_and_deduct(
  p_review_id bigint,
  p_required_credits integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_review public.reviews%ROWTYPE;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF p_required_credits IS NULL OR p_required_credits < 1 THEN
    RAISE EXCEPTION 'INVALID_CREDITS';
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.user_id <> v_uid THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;

  IF v_review.status <> 'pending'::review_status THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  SELECT credits_balance INTO v_balance_before
  FROM public.user_wallets
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance_before < p_required_credits THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  v_balance_after := v_balance_before - p_required_credits;

  UPDATE public.user_wallets
  SET
    credits_balance = v_balance_after,
    version = version + 1,
    updated_at = now()
  WHERE user_id = v_uid;

  INSERT INTO public.credit_transactions (
    user_id,
    amount,
    type,
    reference_id,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    v_uid,
    -p_required_credits,
    'consumption'::transaction_type,
    p_review_id::text,
    v_balance_before,
    v_balance_after,
    jsonb_build_object('review_id', p_review_id)
  );

  UPDATE public.reviews
  SET
    status = 'processing'::review_status,
    cost = p_required_credits,
    stages = jsonb_build_array(
      jsonb_build_object('agent', 'format', 'status', 'pending'),
      jsonb_build_object('agent', 'logic', 'status', 'pending'),
      jsonb_build_object('agent', 'reference', 'status', 'pending')
    ),
    updated_at = now(),
    error_message = NULL
  WHERE id = p_review_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_review_and_deduct(bigint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_review_and_deduct(bigint, integer) TO authenticated;
