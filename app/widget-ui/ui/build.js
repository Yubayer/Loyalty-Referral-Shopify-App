import * as esbuild from "esbuild";

const SRC_ENTRY = "app/widget-ui/ui/main.preact.jsx";
const CSS_SRC = "app/widget-ui/ui/styles/ui.css";

const EXT_JS_OUT = "extensions/theme-extension/assets/ui.min.js";
const PREVIEW_JS_OUT = "public/widget/preview.min.js";
// ui.min.css / preview.min.css ar output hoy na — CSS ekhon ui.min.js /
// preview.min.js-er bhitore __NBL_CSS_TEXT__ hisebe bundle hocche.
// loyalty.liquid theke stylesheet_tag-er link-ta soriye felte hobe.

async function run() {
  const watch = process.argv.includes("--watch");
  const debug = process.argv.includes("--debug"); // TEMP: disables minify to test if minification itself is the bug

  // ui.css ekhon shadow root-er <style> hisebe JS bundle-er bhitor thake —
  // tai age CSS ta minify kore string hisebe niye, seta JS build-er
  // `define`-e inject kori. Alada .css file আর output hoy na, tai
  // EXT_CSS_OUT / PREVIEW_CSS_OUT ebong cssConfigFor সরিয়ে deya hoyeche.
  const cssResult = await esbuild.build({
    entryPoints: [CSS_SRC],
    minify: !debug,
    write: false,
    logLevel: "info",
  });
  const cssText = cssResult.outputFiles[0].text;

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
    define: {
      __NBL_CSS_TEXT__: JSON.stringify(cssText),
    },
    outfile,
    sourcemap: watch && outfile === PREVIEW_JS_OUT,
    logLevel: "info",
  });

  // NOTE: --watch mode-e ekhon CSS change dekhle JS bundle nijei rebuild
  // hoy na, karon cssText ekhon build shuru howar somoy ekbar-i compute hoy.
  // Watch mode thik rakhte hole esbuild.context() shuru korar age cssResult
  // recompute korar plugin lagbe — eituku ekhon out of scope, dorkar hole
  // bolo, alada kore shei watch-rebuild wiring ta korte pari.
  if (watch) {
    const ctxs = await Promise.all([
      esbuild.context(jsConfigFor(EXT_JS_OUT)),
      esbuild.context(jsConfigFor(PREVIEW_JS_OUT)),
    ]);
    await Promise.all(ctxs.map((ctx) => ctx.watch()));
    console.log("Watching app/widget-ui/ui/ for changes...");
  } else {
    await Promise.all([
      esbuild.build(jsConfigFor(EXT_JS_OUT)),
      esbuild.build(jsConfigFor(PREVIEW_JS_OUT)),
    ]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});