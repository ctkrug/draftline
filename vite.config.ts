import { defineConfig } from "vite";

// Relative base so the built site works when hosted under any subpath
// (e.g. apps.charliekrug.com/draftline), not just the domain root.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
  },
});
