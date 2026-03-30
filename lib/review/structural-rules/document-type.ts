/**
 * 文档类型定义。
 * 新增类型时只改这一处，相关规则通过 applicableTo 字段自动生效。
 */
export const DOCUMENT_TYPES = ["chinese_degree_thesis"] as const;

export type DocumentType = typeof DOCUMENT_TYPES[number];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = "chinese_degree_thesis";
