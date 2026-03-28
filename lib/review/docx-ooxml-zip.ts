import yauzl from "yauzl";

/** 单份 OOXML 文本部件上限，防止异常大包导致 OOM */
const MAX_XML_BYTES = 20 * 1024 * 1024;

const HEADER_FOOTER_RE = /^word\/(header|footer)\d+\.xml$/;

/**
 * 使用 yauzl 按 entry 读取 DOCX（zip），加载 `word/document.xml`、`word/styles.xml`
 * 以及所有 `word/header*.xml` / `word/footer*.xml`，不展开 `word/media/` 等大文件。
 */
export function readDocxXmlParts(buffer: Buffer): Promise<{
  documentXml: string;
  stylesXml: string | null;
  headerXmls: string[];
  footerXmls: string[];
}> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      if (!zipfile) {
        reject(new Error("DOCX_INVALID: cannot open zip"));
        return;
      }

      let documentXml: string | null = null;
      let stylesXml: string | null = null;
      const headerXmls: string[] = [];
      const footerXmls: string[] = [];

      zipfile.on("error", reject);
      zipfile.on("end", () => {
        if (!documentXml) {
          reject(new Error("DOCX_INVALID: missing word/document.xml"));
          return;
        }
        resolve({ documentXml, stylesXml, headerXmls, footerXmls });
      });

      zipfile.on("entry", (entry) => {
        const name = entry.fileName;
        const isDocument = name === "word/document.xml";
        const isStyles = name === "word/styles.xml";
        const hfMatch = HEADER_FOOTER_RE.exec(name);

        if (!isDocument && !isStyles && !hfMatch) {
          zipfile.readEntry();
          return;
        }
        if (entry.uncompressedSize > MAX_XML_BYTES) {
          if (isDocument) {
            reject(new Error("DOCX_INVALID: word/document.xml exceeds size limit"));
            return;
          }
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamErr, stream) => {
          if (streamErr) {
            reject(streamErr);
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (c: Buffer) => chunks.push(c));
          stream.on("error", reject);
          stream.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            if (isDocument) {
              documentXml = text;
            } else if (isStyles) {
              stylesXml = text;
            } else if (hfMatch) {
              if (hfMatch[1] === "header") {
                headerXmls.push(text);
              } else {
                footerXmls.push(text);
              }
            }
            zipfile.readEntry();
          });
        });
      });

      zipfile.readEntry();
    });
  });
}
