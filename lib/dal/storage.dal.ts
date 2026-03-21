import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const THESIS_PDFS_BUCKET = "thesis-pdfs";

function sanitizeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return base || "document.pdf";
}

export const storageDAL = {
  /**
   * Upload PDF via service role. Returns storage object path (stored in reviews.file_url).
   */
  async uploadReviewPdf(userId: string, originalName: string, bytes: Buffer): Promise<string> {
    const supabase = createAdminClient();
    const safe = sanitizeFileName(originalName);
    const path = `${userId}/${randomUUID()}_${safe}`;
    const { error } = await supabase.storage.from(THESIS_PDFS_BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) throw new Error(`STORAGE_UPLOAD: ${error.message}`);
    return path;
  },

  async removeObject(path: string): Promise<void> {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(THESIS_PDFS_BUCKET).remove([path]);
    if (error) throw new Error(`STORAGE_REMOVE: ${error.message}`);
  },
};
