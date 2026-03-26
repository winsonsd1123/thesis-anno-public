/** mammoth 无官方 typings，与 lib/index.js 导出对齐 */
declare module "mammoth" {
  export interface Message {
    type: string;
    message?: string;
  }
  export interface ConvertResult {
    value: string;
    messages: Message[];
  }
  export type Input = { buffer: Buffer } | { path: string } | ArrayBuffer;

  /** Mammoth 图片元素（convertImage / imgElement 回调） */
  export interface MammothImageElement {
    contentType: string;
    altText?: string;
    readAsBuffer(): Promise<Buffer>;
    readAsArrayBuffer(): Promise<ArrayBuffer>;
    readAsBase64String(): Promise<string>;
  }

  export type ConvertImageHandler = (
    image: MammothImageElement,
    messages: Message[]
  ) => unknown;

  export interface MammothConvertOptions {
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: ConvertImageHandler;
    transformDocument?: (doc: unknown) => unknown;
    ignoreEmptyParagraphs?: boolean;
    outputFormat?: string;
  }

  export const images: {
    imgElement(
      fn: (image: MammothImageElement) => Promise<{ src?: string; alt?: string }>
    ): ConvertImageHandler;
    dataUri: ConvertImageHandler;
  };

  export function convertToMarkdown(
    input: Input,
    options?: MammothConvertOptions
  ): Promise<ConvertResult>;
  export function extractRawText(input: Input, options?: MammothConvertOptions): Promise<ConvertResult>;
  export function convertToHtml(input: Input, options?: MammothConvertOptions): Promise<ConvertResult>;
  export function convert(input: Input, options?: MammothConvertOptions): Promise<ConvertResult>;

  const mammoth: {
    convertToMarkdown: typeof convertToMarkdown;
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
    convert: typeof convert;
    images: typeof images;
  };
  export default mammoth;
}
