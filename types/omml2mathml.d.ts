declare module "omml2mathml" {
  /**
   * Convert an OMML element (m:oMath or m:oMathPara) to a MathML <math> element.
   * Input must support basic DOM operations (xmldom works).
   * Returns an HTML DOM `math` element (via jsdom on Node).
   */
  function omml2mathml(oMathElement: Element): HTMLElement;
  export = omml2mathml;
}
