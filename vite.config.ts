import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

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
      suspicious: "error",
      perf: "error",
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

      // Rejected members of the suspicious/perf categories (see the reasons).
      // 69 existing narrowing casts; each needs a type guard or schema, not a mechanical fix.
      "typescript/no-unsafe-type-assertion": "off",
      // toSorted()/toReversed() are ES2023; the project's lib/target is ES2020.
      "unicorn/no-array-sort": "off",
      "unicorn/no-array-reverse": "off",
      // React effects mix an early `return;` with a cleanup return by design.
      "typescript/consistent-return": "off",
      // Flags deliberate re-run triggers (retry/attempt counters). Changing them
      // changes when effects fire; react/exhaustive-deps stays on.
      "react/exhaustive-effect-dependencies": "off",
      // Its fix mutates objects in map(); the stores rely on immutable updates.
      "oxc/no-map-spread": "off",

      // Type-aware TypeScript rules
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unnecessary-boolean-literal-compare": "error",
      "typescript/no-unnecessary-template-expression": "error",
      "typescript/no-unnecessary-type-arguments": "error",
      "typescript/prefer-nullish-coalescing": [
        "error",
        // `||` stays legal where a falsy primitive ("", 0, false) must fall back.
        { ignorePrimitives: { string: true, number: true, boolean: true, bigint: true } },
      ],
      "typescript/restrict-plus-operands": "error",
      "typescript/require-await": "error",
      "typescript/return-await": "error",
      "typescript/only-throw-error": "error",
      "typescript/prefer-promise-reject-errors": "error",
      "typescript/non-nullable-type-assertion-style": "error",
      "typescript/prefer-reduce-type-parameter": "error",

      // TypeScript style
      "typescript/consistent-type-imports": [
        "error",
        // Vitest's importOriginal<typeof import("...")>() needs import() types.
        { disallowTypeAnnotations: false, fixStyle: "inline-type-imports" },
      ],
      "typescript/no-import-type-side-effects": "error",
      "typescript/consistent-type-definitions": "error",
      "typescript/array-type": "error",
      "typescript/no-inferrable-types": "error",
      "typescript/no-empty-object-type": "error",
      "typescript/no-unnecessary-type-constraint": "error",

      // ESLint core
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "error",
      "prefer-template": "error",
      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-param-reassign": "error",
      "no-useless-concat": "error",
      "no-useless-return": "error",
      "no-useless-computed-key": "error",
      "default-case-last": "error",
      "no-implicit-coercion": "error",
      "prefer-object-spread": "error",
      "no-unneeded-ternary": "error",
      yoda: "error",
      radix: "error",
      "no-throw-literal": "error",
      "no-return-assign": "error",
      "no-sequences": "error",
      "no-alert": "error",
      "array-callback-return": "error",
      "promise/always-return": ["error", { ignoreLastCallback: true }],

      // Maintainability limits (test files are exempt; see overrides).
      // Existing violators carry a `debt:` disable comment until refactored.
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      "max-lines": ["error", { max: 450, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 200, skipBlankLines: true, skipComments: true }],

      // React
      "react/rules-of-hooks": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/self-closing-comp": "error",
      "react/no-unstable-nested-components": "error",
      "react/jsx-key": "error",
      "react/jsx-no-target-blank": "error",
      "react/no-danger": "error",

      // Imports
      "import/no-self-import": "error",
      "import/first": "error",
      "import/no-duplicates": "error",

      // Unicorn
      "unicorn/prefer-node-protocol": "error",
      // Explicit undefined arguments are meaningful (Map keys, reduce seeds, vi.stubEnv).
      "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
      "unicorn/prefer-array-flat-map": "error",
      "unicorn/no-lonely-if": "error",
      "unicorn/no-negated-condition": "error",
      "unicorn/throw-new-error": "error",
      "unicorn/prefer-type-error": "error",
      "unicorn/no-instanceof-array": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/no-typeof-undefined": "error",

      // Vitest
      "vitest/no-focused-tests": "error",
      "vitest/no-identical-title": "error",
      "vitest/expect-expect": "error",
      "vitest/valid-title": "error",
      "vitest/no-conditional-tests": "error",
      "vitest/no-disabled-tests": "error",
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
        // Tests and the eval harness: size limits do not apply, fixtures stay local to
        // the describe block that uses them, async mocks mirror async signatures, and
        // interactions and requests run sequentially on purpose.
        files: ["**/*.test.{ts,tsx}", "src/test/**", "server/ai/eval/**"],
        rules: {
          complexity: "off",
          "max-depth": "off",
          "max-params": "off",
          "max-nested-callbacks": "off",
          "max-lines": "off",
          "max-lines-per-function": "off",
          "unicorn/consistent-function-scoping": "off",
          "typescript/require-await": "off",
          "no-await-in-loop": "off",
        },
      },
      {
        // Declarative template data: file length tracks catalog content, not logic.
        files: ["src/templates/catalog/**"],
        rules: { "max-lines": "off" },
      },
      {
        files: [
          "src/schemas/**",
          "src/services/api.ts",
          "src/services/api/**",
          "src/services/iconify.ts",
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
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "server/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}", "server/**/*.ts"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "server/ai/eval/**",
      ],
      // Ratchet: just under measured coverage (69.4 / 63.5 / 72.1 / 69.3). Raise, never lower.
      thresholds: {
        statements: 69,
        branches: 63,
        functions: 72,
        lines: 69,
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
