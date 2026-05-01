import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    clean: true,
    dts: true,
    entry: {
      index: "./src/index.ts",
      cookies: "./src/cookies/index.ts",
    },
    format: ["esm"],
    outDir: "./dist",
    platform: "node",
    target: "node22",
    sourcemap: false,
    treeshake: true,
  },
});
