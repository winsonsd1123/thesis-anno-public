/**
 * AI 痕迹 Map-Reduce：按 Hybrid Parser 产出的 Markdown 切块（DOCX 迁移 §3.3）。
 * 约 2000 字、仅在段落边界合并；超长单段不中段切断，单独成块。
 */

export const AITRACE_MARKDOWN_CHUNK_CHARS = 5000;

/** 首个标题出现前的占位章节名（与提示词一致） */
export const AITRACE_DEFAULT_SECTION_LABEL = "文档开头";

const ATX_HEADING = /^#{1,6}\s+(.+)$/;

function extractAtxHeadingLine(line: string): string | null {
  const m = line.trim().match(ATX_HEADING);
  return m ? m[1].trim() : null;
}

type Segment = {
  sectionTitle: string;
  paragraphIndexInSection: number;
  body: string;
};

function buildSegments(markdown: string): Segment[] {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  const blocks = trimmed.split(/\n\n+/).filter(Boolean);
  const segments: Segment[] = [];

  let sectionTitle = AITRACE_DEFAULT_SECTION_LABEL;
  let paragraphIndexInSection = 0;

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] ?? "";
    const headingFromFirst = extractAtxHeadingLine(firstLine);

    if (headingFromFirst !== null && lines.length === 1) {
      sectionTitle = headingFromFirst;
      paragraphIndexInSection = 0;
      continue;
    }

    if (headingFromFirst !== null && lines.length > 1) {
      sectionTitle = headingFromFirst;
      paragraphIndexInSection = 0;
      const body = lines.slice(1).join("\n").trim();
      if (body) {
        paragraphIndexInSection += 1;
        segments.push({
          sectionTitle,
          paragraphIndexInSection,
          body,
        });
      }
      continue;
    }

    paragraphIndexInSection += 1;
    segments.push({
      sectionTitle,
      paragraphIndexInSection,
      body: block.trim(),
    });
  }

  return segments;
}

function formatSegmentPiece(sectionTitle: string, paragraphIndexInSection: number, body: string): string {
  return `--- [${sectionTitle} - 第 ${paragraphIndexInSection} 段] ---\n${body}`;
}

/**
 * 将论文 Markdown 切为若干带 `--- [章节名 - 第 N 段] ---` 锚点的 chunk，供 `aitrace_chunk` 并发调用。
 */
export function buildAiTraceChunksFromMarkdown(
  markdown: string,
  maxCharsPerChunk: number = AITRACE_MARKDOWN_CHUNK_CHARS
): string[] {
  const segments = buildSegments(markdown);
  if (segments.length === 0) return [];

  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf) {
      chunks.push(buf);
      buf = "";
    }
  };

  for (const seg of segments) {
    const piece = formatSegmentPiece(seg.sectionTitle, seg.paragraphIndexInSection, seg.body);

    // 超长单段：不中段切断，单独成块（§3.3 策略 A）
    if (piece.length > maxCharsPerChunk) {
      flush();
      chunks.push(piece);
      continue;
    }

    const candidate = buf ? `${buf}\n\n${piece}` : piece;
    if (candidate.length > maxCharsPerChunk && buf.length > 0) {
      flush();
      buf = piece;
    } else {
      buf = candidate;
    }
  }
  flush();

  return chunks;
}
