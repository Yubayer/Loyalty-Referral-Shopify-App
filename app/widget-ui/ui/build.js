import * as esbuild from "esbuild";

const SRC_ENTRY = "app/widget-ui/ui/main.preact.jsx";
const CSS_SRC = "app/widget-ui/ui/styles/ui.css";

const EXT_JS_OUT = "extensions/theme-extension/assets/ui.min.js";
const EXT_CSS_OUT = "extensions/theme-extension/assets/ui.min.css";
const PREVIEW_JS_OUT = "public/widget/preview.min.js";
const PREVIEW_CSS_OUT = "public/widget/preview.min.css";

async function run() {
  const watch = process.argv.includes("--watch");
  const debug = process.argv.includes("--debug"); // TEMP: disables minify to test if minification itself is the bug

  // Two JS outputs from the same source: the real storefront bundle, and
  // the admin live-preview bundle (loaded by public/widget/preview.html
  // inside the isolated iframe — see LivePreview.jsx).
  const jsConfigFor = (outfile) => ({
    entryPoints: [SRC_ENTRY],
    bundle: true,
    minify: !debug,
    format: "iife",
    target: ["es2018"],
    jsx: "transform",
    jsxFactory: "h",
    jsxFragment: "Fragment",
    tsconfigRaw: "{}", // Prevent esbuild from picking up tsconfig.json's
    // "jsx": "react-jsx" (automatic runtime), which silently overrides the
    // explicit jsxFactory/jsxFragment above on esbuild 0.24.x and produces
    // eo.jsx()-style automatic-runtime calls instead of h() calls — these
    // vnodes aren't shaped the way Preact's render() expects, so App()
    // mounts into an empty root with no thrown error.
    outfile,
    sourcemap: watch && outfile === PREVIEW_JS_OUT,
    logLevel: "info",
  });

  const cssConfigFor = (outfile) => ({
    entryPoints: [CSS_SRC],
    minify: true,
    outfile,
    logLevel: "info",
  });

  // Rollup previously watched ui.css separately and copied it unminified
  // in dev. esbuild's own watch mode already rebuilds on CSS changes via
  // its own context/watch, so no extra plugin is needed here.

  if (watch) {
    const ctxs = await Promise.all([
      esbuild.context(jsConfigFor(EXT_JS_OUT)),
      esbuild.context(jsConfigFor(PREVIEW_JS_OUT)),
      esbuild.context(cssConfigFor(EXT_CSS_OUT)),
      esbuild.context(cssConfigFor(PREVIEW_CSS_OUT)),
    ]);
    await Promise.all(ctxs.map((ctx) => ctx.watch()));
    console.log("Watching app/widget-ui/ui/ for changes...");
  } else {
    await Promise.all([
      esbuild.build(jsConfigFor(EXT_JS_OUT)),
      esbuild.build(jsConfigFor(PREVIEW_JS_OUT)),
      esbuild.build(cssConfigFor(EXT_CSS_OUT)),
      esbuild.build(cssConfigFor(PREVIEW_CSS_OUT)),
    ]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});