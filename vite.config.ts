import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  fmt: {},
  lint: {
    plugins: [
      "eslint",
      "typescript",
      "unicorn",
      "oxc",
      "react",
      "import",
      "jsx-a11y",
      "promise",
      "vitest",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    categories: {
      correctness: "error",
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "react/react-in-jsx-scope": "off",
      "import/no-unassigned-import": "off",
      "import/no-cycle": ["error", { maxDepth: 10 }],
      "typescript/no-explicit-any": "error",
      "typescript/ban-ts-comment": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-misused-promises": "error",
      "typescript/switch-exhaustiveness-check": "error",
      eqeqeq: "error",
      curly: "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "react/button-has-type": "error",
      "react/no-array-index-key": "error",
    },
    settings: {
      react: { version: "19.3.1" },
    },
    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: "error",
    },
    overrides: [
      {
        files: [
          "src/schemas/**",
          "src/hooks/useCollaboration.ts",
          "src/services/api.ts",
          "src/services/iconify.ts",
          "src/services/ai/providers/openai.ts",
          "src/services/collaborationIdentity.ts",
          "src/utils/import.ts",
        ],
        rules: {
          "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
        },
      },
      {
        files: ["src/schemas/**"],
        rules: {
          "no-restricted-properties": [
            "error",
            { object: "z", property: "any", message: "Use a concrete schema at trust boundaries." },
            {
              object: "z",
              property: "unknown",
              message: "Validate each consumed field with a concrete schema.",
            },
            {
              object: "z",
              property: "custom",
              message: "Do not replace structural validation with a type assertion.",
            },
            {
              object: "z",
              property: "looseObject",
              message: "Declare supported fields explicitly.",
            },
            { property: "passthrough", message: "Declare supported fields explicitly." },
            {
              property: "catch",
              message: "Reject malformed input instead of accepting a fallback.",
            },
          ],
        },
      },
    ],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/**/*.d.ts", "src/main.tsx", "src/vite-env.d.ts"],
      thresholds: {
        statements: 14,
        branches: 12,
        functions: 13,
        lines: 15,
      },
    },
  },
  plugins: lazyPlugins(() => [react(), tailwindcss()]) ?? [],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
