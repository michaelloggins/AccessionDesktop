import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: "all",
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
        timeout: 1800000,  // 30 min — CPU OCR is very slow
      },
    },
  },
});
