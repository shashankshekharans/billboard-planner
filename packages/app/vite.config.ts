import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Uses the other packages' sources directly, so the app always renders with the same template and rules as the CLI.
export default defineConfig({
  base: "./",
  plugins: [preact()],
  resolve: {
    alias: {
      "@billboard-planner/core": at("../core/src/index.ts"),
      "@billboard-planner/cli/sheets": at("../cli/src/sheets.ts"),
      "@billboard-planner/template/render": at("../template/render.js")
    }
  },
  server: { fs: { allow: [at("../../")] } },
  build: { outDir: "dist", target: "es2022", chunkSizeWarningLimit: 1500 }
});
