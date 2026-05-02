import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENTRY = process.env.VITE_ENTRY as "background" | "content" | "options" | undefined;
const SKIP_ASSETS = process.env.VITE_SKIP_ASSETS === "1";
const FIRST = process.env.VITE_FIRST === "1";

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = out[key as keyof T];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      (out as Record<string, unknown>)[key] = mergeDeep(
        bv as Record<string, unknown>,
        pv as Record<string, unknown>,
      );
    } else {
      (out as Record<string, unknown>)[key] = pv;
    }
  }
  return out;
}

function manifestPlugin(browser: "firefox" | "chrome"): Plugin {
  let resolved: ResolvedConfig;

  return {
    name: "langpeek-manifest",
    configResolved(config) {
      resolved = config;
    },
    writeBundle() {
      const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")) as {
        version: string;
      };
      const base = JSON.parse(
        readFileSync(join(__dirname, "manifest/base.json"), "utf8"),
      ) as Record<string, unknown>;
      const overlay = JSON.parse(
        readFileSync(join(__dirname, `manifest/${browser}.json`), "utf8"),
      ) as Record<string, unknown>;
      const merged = mergeDeep(base, overlay);
      merged.version = pkg.version;
      const out = join(resolved.build.outDir, "manifest.json");
      mkdirSync(resolved.build.outDir, { recursive: true });
      writeFileSync(out, JSON.stringify(merged, null, 2) + "\n");
    },
  };
}

function chromeServiceWorkerPolyfill(): Plugin {
  return {
    name: "langpeek-chrome-sw-polyfill",
    renderChunk(code, chunk) {
      if (chunk.name !== "background") return null;
      return {
        code: `importScripts('browser-polyfill.min.js');\n${code}`,
        map: null,
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const browser = mode === "chrome" ? "chrome" : "firefox";
  const outDir = join(__dirname, "dist", browser);

  if (!ENTRY || !["background", "content", "options"].includes(ENTRY)) {
    throw new Error(
      'Set VITE_ENTRY to "background", "content", or "options" (build is split for IIFE + MV3).',
    );
  }

  const input = { [ENTRY]: resolve(__dirname, `src/${ENTRY}.js`) };

  const assetPlugins: Plugin[] = [];
  if (!SKIP_ASSETS) {
    assetPlugins.push(
      viteStaticCopy({
        targets: [
          {
            src: "node_modules/webextension-polyfill/dist/browser-polyfill.min.js",
            dest: ".",
            rename: "browser-polyfill.min.js",
          },
          { src: "icons/*", dest: "icons" },
          { src: "src/styles.css", dest: ".", rename: "styles.css" },
          { src: "src/options.css", dest: ".", rename: "options.css" },
          { src: "src/options.html", dest: "." },
        ],
      }),
      manifestPlugin(browser),
    );
  }

  return {
    root: __dirname,
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: FIRST,
      minify: "esbuild",
      sourcemap: false,
      rollupOptions: {
        input,
        output: {
          format: "iife",
          entryFileNames: "[name].js",
        },
      },
    },
    plugins: [
      ...(browser === "chrome" && ENTRY === "background" ? [chromeServiceWorkerPolyfill()] : []),
      ...assetPlugins,
    ],
  };
});
