import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@financial-engine": path.resolve(__dirname, "./shared/financial-engine"),
      "@policy-engine": path.resolve(__dirname, "./shared/policy-engine"),
      "@knowledge-engine": path.resolve(__dirname, "./shared/knowledge-engine"),
      "@assistant-context": path.resolve(__dirname, "./shared/assistant-context"),
    },
  },
  test: {
    include: [
      "shared/financial-engine/**/*.test.ts",
      "shared/policy-engine/**/*.test.ts",
      "shared/comparison-snapshot/**/*.test.ts",
      "shared/knowledge-engine/**/*.test.ts",
      "shared/assistant-context/**/*.test.ts",
      "shared/alternative-diagnostics/**/*.test.ts",
      "shared/documentation-requirements/**/*.test.ts",
      "shared/zero-interest-alternative/**/*.test.ts",
      "shared/admin-analytics/**/*.test.ts",
      "src/features/simulator/**/*.test.ts",
    ],
    environment: "node",
  },
});
