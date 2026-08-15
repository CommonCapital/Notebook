// LaTeX -> self-contained SVG, so a formula can live on the Konva canvas as a
// crisp vector image (sharp at any size) and export in PNG/scene like anything
// else. MathJax is initialized once, lazily, on the client.

type Tex2Svg = (latex: string, display: boolean) => string;

let converterPromise: Promise<Tex2Svg> | null = null;

async function getConverter(): Promise<Tex2Svg> {
  if (converterPromise) return converterPromise;

  converterPromise = (async () => {
    // MathJax's version.js does `eval('require')` in Node unless the global
    // `PACKAGE_VERSION` is already defined — which explodes in a browser bundle.
    // Defining it here (before the dynamic import evaluates that module) makes
    // MathJax take the no-op branch instead. Must run before the import() below.
    const g = globalThis as unknown as { PACKAGE_VERSION?: string };
    if (typeof g.PACKAGE_VERSION === "undefined") g.PACKAGE_VERSION = "3.2.2";

    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] =
      await Promise.all([
        import("mathjax-full/js/mathjax.js"),
        import("mathjax-full/js/input/tex.js"),
        import("mathjax-full/js/output/svg.js"),
        import("mathjax-full/js/adaptors/liteAdaptor.js"),
        import("mathjax-full/js/handlers/html.js"),
        // TeX extensions register themselves on import. We import a curated set
        // (rather than AllPackages) to avoid MathJax's runtime `require()`-based
        // autoloader, which isn't defined in a browser bundle.
        import("mathjax-full/js/input/tex/base/BaseConfiguration.js"),
        import("mathjax-full/js/input/tex/ams/AmsConfiguration.js"),
        import("mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js"),
        import("mathjax-full/js/input/tex/configmacros/ConfigMacrosConfiguration.js"),
        import("mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js"),
        import("mathjax-full/js/input/tex/color/ColorConfiguration.js"),
        import("mathjax-full/js/input/tex/textmacros/TextMacrosConfiguration.js"),
        // mhchem: chemistry / nuclear notation via \ce{...} and \pu{...}.
        import("mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js"),
      ]);

    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const tex = new TeX({
      packages: [
        "base", "ams", "newcommand", "configmacros",
        "noundefined", "color", "textmacros", "mhchem",
      ],
    });
    // fontCache "none" inlines every glyph path, so the SVG stands alone when
    // embedded as an <img> / Konva image (no external <use> refs to break).
    const svg = new SVG({ fontCache: "none" });
    const doc = mathjax.document("", { InputJax: tex, OutputJax: svg });

    return (latex: string, display: boolean) => {
      const node = doc.convert(latex, { display });
      return adaptor.innerHTML(node); // the <svg>…</svg> string
    };
  })();

  return converterPromise;
}

export interface RenderedMath {
  dataUrl: string; // data:image/svg+xml,…
  width: number; // intrinsic px
  height: number; // intrinsic px
}

const EX_TO_PX = 11; // readable default; the element is freely resizable after.

function svgDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/**
 * Render LaTeX to an SVG data URL plus its intrinsic pixel size.
 * Throws if MathJax cannot parse the expression.
 */
export async function renderMath(latex: string, color: string): Promise<RenderedMath> {
  const convert = await getConverter();
  let svg = convert(latex || "", true);

  // MathJax colors glyphs with `currentColor`; there's no CSS context inside an
  // <img>, so bake the chosen color straight into the markup.
  svg = svg.replace(/currentColor/g, color);

  const w = /width="([\d.]+)ex"/.exec(svg);
  const h = /height="([\d.]+)ex"/.exec(svg);
  const width = w ? parseFloat(w[1]) * EX_TO_PX : 40;
  const height = h ? parseFloat(h[1]) * EX_TO_PX : 20;

  return { dataUrl: svgDataUrl(svg), width, height };
}

// A few ready-made snippets and symbols for the palette so students don't have
// to memorize LaTeX. `${}` marks where the cursor should land after insertion.
export interface Snippet {
  label: string;
  insert: string;
  title: string;
}

export const MATH_PALETTE: { group: string; items: Snippet[] }[] = [
  {
    group: "Structure",
    items: [
      { label: "x²", insert: "^{${}}", title: "Superscript" },
      { label: "xₙ", insert: "_{${}}", title: "Subscript" },
      { label: "a⁄b", insert: "\\frac{${}}{}", title: "Fraction" },
      { label: "√", insert: "\\sqrt{${}}", title: "Square root" },
      { label: "ⁿ√", insert: "\\sqrt[${}]{}", title: "nth root" },
      { label: "()", insert: "\\left( ${} \\right)", title: "Auto-size parens" },
    ],
  },
  {
    group: "Calculus",
    items: [
      { label: "∑", insert: "\\sum_{${}}^{}", title: "Sum" },
      { label: "∏", insert: "\\prod_{${}}^{}", title: "Product" },
      { label: "∫", insert: "\\int_{${}}^{}", title: "Integral" },
      { label: "∮", insert: "\\oint", title: "Contour integral" },
      { label: "∂", insert: "\\partial ${}", title: "Partial" },
      { label: "∇", insert: "\\nabla ${}", title: "Nabla / grad" },
      { label: "lim", insert: "\\lim_{${} \\to }", title: "Limit" },
      { label: "d/dx", insert: "\\frac{d}{dx} ${}", title: "Derivative" },
    ],
  },
  {
    group: "Greek",
    items: [
      { label: "α", insert: "\\alpha ", title: "alpha" },
      { label: "β", insert: "\\beta ", title: "beta" },
      { label: "γ", insert: "\\gamma ", title: "gamma" },
      { label: "θ", insert: "\\theta ", title: "theta" },
      { label: "λ", insert: "\\lambda ", title: "lambda" },
      { label: "μ", insert: "\\mu ", title: "mu" },
      { label: "π", insert: "\\pi ", title: "pi" },
      { label: "σ", insert: "\\sigma ", title: "sigma" },
      { label: "φ", insert: "\\phi ", title: "phi" },
      { label: "ω", insert: "\\omega ", title: "omega" },
      { label: "Δ", insert: "\\Delta ", title: "Delta" },
      { label: "Ω", insert: "\\Omega ", title: "Omega" },
    ],
  },
  {
    group: "Relations & ops",
    items: [
      { label: "≤", insert: "\\leq ", title: "less or equal" },
      { label: "≥", insert: "\\geq ", title: "greater or equal" },
      { label: "≠", insert: "\\neq ", title: "not equal" },
      { label: "≈", insert: "\\approx ", title: "approx" },
      { label: "×", insert: "\\times ", title: "times" },
      { label: "·", insert: "\\cdot ", title: "dot" },
      { label: "±", insert: "\\pm ", title: "plus-minus" },
      { label: "∞", insert: "\\infty ", title: "infinity" },
      { label: "→", insert: "\\to ", title: "to" },
      { label: "⇒", insert: "\\Rightarrow ", title: "implies" },
      { label: "∈", insert: "\\in ", title: "element of" },
      { label: "vec", insert: "\\vec{${}}", title: "vector" },
    ],
  },
];

export const MATH_EXAMPLES: { label: string; latex: string }[] = [
  { label: "Quadratic", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { label: "Relativity", latex: "E = mc^2 \\qquad E^2 = (pc)^2 + (mc^2)^2" },
  { label: "Nuclear", latex: "\\ce{^{6}_{3}Li + ^{1}_{0}n -> ^{3}_{1}H + ^{4}_{2}He} + 4.8\\,\\text{MeV}" },
  { label: "Chemistry", latex: "\\ce{2H2 + O2 -> 2H2O}" },
  { label: "Function", latex: "G : \\mathbb{R}^n \\to [0, 1]" },
  { label: "Gauss", latex: "\\oint_{\\partial \\Omega} \\vec{E} \\cdot d\\vec{A} = \\frac{Q}{\\varepsilon_0}" },
  { label: "Fourier", latex: "\\hat{f}(\\xi) = \\int_{-\\infty}^{\\infty} f(x)\\, e^{-2\\pi i x \\xi}\\, dx" },
  { label: "Matrix", latex: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix} \\begin{bmatrix} x \\\\ y \\end{bmatrix}" },
];
