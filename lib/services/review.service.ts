import { reviewAdminDAL } from "@/lib/dal/review.admin.dal";
import { reviewDAL } from "@/lib/dal/review.dal";
import type { ReviewResult, ReviewRow, ReviewStageEntry, ReviewStatus } from "@/lib/types/review";

/**
 * 审阅领域业务层：Actions / RSC / Route Handler 只依赖本模块，由本模块调用 DAL。
 */
export const reviewService = {
  async listReviewsForUser(userId: string): Promise<ReviewRow[]> {
    return reviewDAL.listByUser(userId);
  },

  async getReviewForUser(reviewId: number, userId: string): Promise<ReviewRow | null> {
    return reviewDAL.getByIdForUser(reviewId, userId);
  },

  async insertReview(input: {
    userId: string;
    fileUrl: string;
    fileName: string;
    domain: string;
    pageCount: number | null;
  }): Promise<number> {
    return reviewDAL.insertReview(input);
  },

  async updateDomain(reviewId: number, userId: string, domain: string): Promise<void> {
    return reviewDAL.updateDomain(reviewId, userId, domain);
  },

  async renameReview(reviewId: number, userId: string, name: string): Promise<void> {
    return reviewDAL.renameReview(reviewId, userId, name);
  },

  /** 删除行并返回原 file_url（供上层删 Storage） */
  async deleteReview(reviewId: number, userId: string): Promise<string | null> {
    return reviewDAL.deleteReview(reviewId, userId);
  },

  async updateReviewFile(
    reviewId: number,
    userId: string,
    input: { fileUrl: string; fileName: string; pageCount: number | null }
  ): Promise<void> {
    return reviewDAL.updateReviewFile(reviewId, userId, input);
  },

  async updateStatus(reviewId: number, userId: string, status: ReviewStatus): Promise<void> {
    return reviewAdminDAL.updateStatus(reviewId, userId, status);
  },

  async updateProcessingStart(input: {
    reviewId: number;
    userId: string;
    cost: number;
    stages: ReviewStageEntry[];
    triggerRunId: string | null;
  }): Promise<void> {
    return reviewDAL.updateProcessingStart(input);
  },

  async updateStages(reviewId: number, userId: string, stages: ReviewStageEntry[]): Promise<void> {
    return reviewAdminDAL.updateStages(reviewId, userId, stages);
  },

  async setCompleted(reviewId: number, userId: string, result: ReviewResult): Promise<void> {
    return reviewAdminDAL.setCompleted(reviewId, userId, result);
  },

  async setFailed(
    reviewId: number,
    userId: string,
    errorMessage: string,
    status: "failed" | "needs_manual_review"
  ): Promise<void> {
    return reviewAdminDAL.setFailed(reviewId, userId, errorMessage, status);
  },
};
