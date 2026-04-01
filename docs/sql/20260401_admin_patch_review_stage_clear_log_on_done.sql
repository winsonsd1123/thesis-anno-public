-- 阶段完成时若未传入 p_log，应清除该 agent 的 log，避免前端 stagesToLogLines 仍展示「正在…」类 running 文案
-- 与 20260322 版本相比：CASE 在 p_status = 'done' 且 p_log IS NULL 时写入 NULL，jsonb_strip_nulls 会去掉 log 键

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
  IF p_agent NOT IN ('format', 'logic', 'aitrace', 'reference') THEN
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
              jsonb_build_object('agent', 'aitrace', 'status', 'pending'),
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
                    WHEN p_status = 'done' AND p_log IS NULL THEN NULL::jsonb
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
