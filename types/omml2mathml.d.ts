declare module "omml2mathml" {
  /**
   * Convert an OMML element (m:oMath or m:oMathPara) to a MathML <math> element.
   * Input must support basic DOM operations (xmldom works).
   * Returns an HTML DOM `math` element (via jsdom on Node).
   */
  /** xmldom 的 Element 与 DOM lib 的 Element 在 0.9+ 类型上不兼容，二者皆可传入 */
  function omml2mathml(
    oMathElement: Element | import("@xmldom/xmldom").Element,
  ): HTMLElement;
  export = omml2mathml;
}
