-- Reference copy: applied via Supabase migration `admin_patch_review_stage`
-- Atomically patch one agent in reviews.stages (parallel Trigger workers safe)

CREATE OR REPLACE FUNCTION public.admin_patch_review_stage(
  p_review_id bigint,
  p_agent text,
  p_status text,
  p_log text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  IF p_agent NOT IN ('format', 'logic', 'reference') THEN
    RAISE EXCEPTION 'INVALID_AGENT';
  END IF;

  IF p_status NOT IN ('pending', 'running', 'done', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STAGE_STATUS';
  END IF;

  UPDATE public.reviews r
  SET
    stages = (
      WITH src AS (
        SELECT
          CASE
            WHEN r.stages IS NOT NULL
              AND jsonb_typeof(r.stages) = 'array'
              AND jsonb_array_length(r.stages) > 0
            THEN r.stages
            ELSE jsonb_build_array(
              jsonb_build_object('agent', 'format', 'status', 'pending'),
              jsonb_build_object('agent', 'logic', 'status', 'pending'),
              jsonb_build_object('agent', 'reference', 'status', 'pending')
            )
          END AS arr
      )
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN elem->>'agent' = p_agent THEN
              jsonb_strip_nulls(
                jsonb_build_object(
                  'agent', elem->'agent',
                  'status', to_jsonb(p_status),
                  'log',
                  CASE
                    WHEN p_log IS NOT NULL THEN to_jsonb(p_log)
                    ELSE elem->'log'
                  END
                )
              )
            ELSE elem
          END
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements((SELECT arr FROM src)) AS elem
    ),
    updated_at = now()
  WHERE r.id = p_review_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'REVIEW_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_patch_review_stage(bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_patch_review_stage(bigint, text, text, text) TO service_role;
