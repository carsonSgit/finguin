import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: { proxy: mode === "demo" ? {} : { "/api": "http://127.0.0.1:5187" } },
  preview: { proxy: {} },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
}));
