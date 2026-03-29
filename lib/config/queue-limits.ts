export const QUEUE_LIMITS = {
  /** LLM 批处理子任务队列并发上限（同时也是 wave 分批大小的依据） */
  LLM_BATCH_CONCURRENCY: 3,
  /** 主编排任务队列并发上限 */
  MAIN_REVIEW_CONCURRENCY: 5,
} as const;
