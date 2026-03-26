/**
 * 论文上传：仅允许 .docx（OOXML），显式拒绝旧版二进制 .doc。
 * 浏览器可能给出空 MIME 或 application/octet-stream，故以扩展名为准并放宽 MIME。
 */

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const LEGACY_DOC_MIME = "application/msword";

/** 在扩展名为 .docx 时，部分环境会误报为 octet-stream / zip（docx 实为 zip 包） */
function isAcceptableDocxMime(type: string): boolean {
  if (!type) return true;
  if (type === DOCX_MIME) return true;
  if (type === "application/octet-stream") return true;
  if (type === "application/zip") return true;
  return false;
}

export function isRejectedLegacyDoc(file: { name: string; type: string }): boolean {
  if (file.type === LEGACY_DOC_MIME) return true;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".doc") && !lower.endsWith(".docx")) return true;
  return false;
}

export function isAllowedDocx(file: { name: string; type: string }): boolean {
  if (isRejectedLegacyDoc(file)) return false;
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".docx")) return false;
  return isAcceptableDocxMime(file.type);
}
