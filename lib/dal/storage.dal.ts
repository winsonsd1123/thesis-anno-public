import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCX_MIME } from "@/lib/browser/thesis-file";

export const THESIS_PDFS_BUCKET = "thesis-pdfs";

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return base || "document.docx";
}

export const storageDAL = {
  /**
   * Upload thesis file via service role. Returns storage object path (stored in reviews.file_url).
   */
  async uploadReviewFile(userId: string, originalName: string, bytes: Buffer, contentType: string): Promise<string> {
    const supabase = createAdminClient();
    const safe = sanitizeFileName(originalName);
    const path = `${userId}/${randomUUID()}_${safe}`;
    const { error } = await supabase.storage.from(THESIS_PDFS_BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`STORAGE_UPLOAD: ${error.message}`);
    return path;
  },

  /** 暂存路径，待用户确认计费后再 promote 到正式路径。 */
  async uploadStagingDocx(userId: string, bytes: Buffer): Promise<string> {
    const supabase = createAdminClient();
    const path = `${userId}/staging_${randomUUID()}.docx`;
    const { error } = await supabase.storage.from(THESIS_PDFS_BUCKET).upload(path, bytes, {
      contentType: DOCX_MIME,
      upsert: false,
    });
    if (error) throw new Error(`STORAGE_UPLOAD: ${error.message}`);
    return path;
  },

  /** 将 staging 对象下载后以正式路径重新上传并删除 staging（同内容二次校验用）。 */
  async promoteStagingToFinal(stagingPath: string, userId: string, originalName: string): Promise<string> {
    const bytes = await this.downloadReviewPdf(stagingPath);
    const finalPath = await this.uploadReviewFile(userId, originalName, bytes, DOCX_MIME);
    await this.removeObject(stagingPath);
    return finalPath;
  },

  async removeObject(path: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(THESIS_PDFS_BUCKET).remove([path]);
    if (error) throw new Error(`STORAGE_REMOVE: ${error.message}`);
  },

  /** Service role 下载审阅文件（Trigger / 后台任务）。 */
  async downloadReviewPdf(path: string): Promise<Buffer> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(THESIS_PDFS_BUCKET).download(path);
    if (error) throw new Error(`STORAGE_DOWNLOAD: ${error.message}`);
    if (!data) throw new Error("STORAGE_DOWNLOAD_EMPTY");
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  },
};
