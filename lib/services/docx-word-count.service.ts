import mammoth from "mammoth";

/**
 * 论文字数（计费口径）：
 * - 汉字（Unicode Script=Han）逐字计；
 * - 英文按词计（ASCII 拉丁字母词，可含连字符与撇号）；
 * - 连续阿拉伯数字按一段计。
 * 与「字符数」区别：空白、标点、符号单独不计入。
 */
export function countThesisWordsFromRawText(text: string): number {
  let sum = 0;
  const han = text.match(/\p{Script=Han}/gu);
  if (han) sum += han.length;

  const latinWords = text.match(/\b[a-zA-Z]+(?:[-'\u2019][a-zA-Z]+)*\b/g);
  if (latinWords) sum += latinWords.length;

  const digits = text.match(/\d+/g);
  if (digits) sum += digits.length;

  return sum;
}

export async function countWordsFromDocxBuffer(buf: Buffer): Promise<number> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return countThesisWordsFromRawText(value);
}
