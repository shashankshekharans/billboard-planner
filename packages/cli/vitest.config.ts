import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Test against core's source so core does not need building first.
export default defineConfig({
  resolve: { alias: { "@billboard-planner/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) } },
  test: { testTimeout: 30000 }
});
