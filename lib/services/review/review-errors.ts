/** 审阅引擎层向上抛出的可识别错误，由 Trigger 编排决定重试或挂起。 */
export class ReviewEngineError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ReviewEngineError";
  }
}
