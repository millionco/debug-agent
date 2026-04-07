import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*.{js,ts}": "vp check --fix",
  },
  fmt: {
    semi: true,
    singleQuote: false,
    ignorePatterns: ["node_modules", "dist", "pnpm-lock.yaml", ".changeset"],
  },
  lint: {
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-var": "error",
      eqeqeq: "warn",
      "no-console": "off",
    },
    ignorePatterns: ["node_modules", "dist", "coverage", "pnpm-lock.yaml"],
  },
});
