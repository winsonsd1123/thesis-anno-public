import mammoth from "mammoth";
import sharp from "sharp";
import type { DocxCompressedImagePart } from "@/lib/types/docx-hybrid";

/** 单篇论文最多处理的图片数量（与规范示例一致）；超出则占位且不读入字节 */
export const MAX_DOCX_IMAGES = 50;

/** Sharp 降采样最大宽度（px） */
export const MAX_DOCX_IMAGE_WIDTH = 1024;

export type DocxImagePipelineState = {
  images: DocxCompressedImagePart[];
  /** 因超过数量上限而跳过的图片数 */
  imagesSkipped: number;
};

export function createDocxImagePipelineState(): DocxImagePipelineState {
  return { images: [], imagesSkipped: 0 };
}

/**
 * Mammoth `convertImage`：读入原图 → Sharp 限宽 WebP（失败则 JPEG）→ 收集 Base64；
 * Markdown 中仅输出 `![图N]()` 占位，避免巨型 data URI 进入正文。
 */
export function createDocxImageConvertImage(state: DocxImagePipelineState) {
  let sequence = 0;

  return mammoth.images.imgElement(async (image) => {
    sequence += 1;

    if (sequence > MAX_DOCX_IMAGES) {
      state.imagesSkipped += 1;
      return {
        src: "",
        alt: "图片由于数量限制被忽略",
      };
    }

    let buffer: Buffer;
    try {
      buffer = await image.readAsBuffer();
    } catch {
      return {
        src: "",
        alt: `图${sequence}（读取失败）`,
      };
    }

    try {
      const { dataBase64, mediaType } = await compressDocxImageBuffer(buffer);
      state.images.push({
        order: sequence,
        mediaType,
        dataBase64,
      });
      return {
        src: "",
        alt: `图${sequence}`,
      };
    } catch {
      return {
        src: "",
        alt: `图${sequence}（无法压缩）`,
      };
    }
  });
}

async function compressDocxImageBuffer(
  buffer: Buffer
): Promise<{ dataBase64: string; mediaType: string }> {
  try {
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_DOCX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { dataBase64: out.toString("base64"), mediaType: "image/webp" };
  } catch {
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_DOCX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { dataBase64: out.toString("base64"), mediaType: "image/jpeg" };
  }
}
