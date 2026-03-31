# DOCX 公式内联替换与 LaTeX 后处理

## 背景
公式提取后仅追加在 Markdown 末尾附录，LLM 分块审阅时看不到公式导致误报"缺少公式"。
omml2mathml 将多字符文本拆为单字符 `<mi>`，LaTeX 中函数名变为 `A t t e n t i o n`。

## 方案
方案一：Markdown 内联插入 + LaTeX 后处理

## 改动清单
| 文件 | 操作 | 内容 |
|---|---|---|
| lib/review/docx-math-extractor.ts | 修改 | +prevText、+postProcessLatex、重写 appendMathToMarkdown |
| lib/review/docx-math-extractor.test.ts | 修改 | 更新/新增测试用例 |

## 执行步骤
1. MathFragment 类型增强：新增 prevText 字段
2. extractMathFragments 增强：记录前文段落文本
3. 新增 postProcessLatex 函数
4. 重写 appendMathToMarkdown 为内联插入
5. 更新测试用例
6. 运行测试 + 冒烟验证
