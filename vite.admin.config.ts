import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The CMS that ships inside every exported site: one self-contained admin.js + admin.css.
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist/runtime",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: { entry: "src/site-admin/main.tsx", name: "SiteAdmin", formats: ["iife"], fileName: () => "admin.js" },
    rollupOptions: { output: { assetFileNames: "admin.[ext]" } },
  },
});
