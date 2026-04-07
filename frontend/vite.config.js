import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Copy Dynamsoft Web TWAIN resources to public/dwt-resources at build time.
    // These files are required by the DWT SDK at runtime to communicate with Dynamsoft Service.
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/dwt/dist/src/*",
          dest: "dwt-resources/src",
        },
        {
          src: "node_modules/dwt/dist/dist/*",
          dest: "dwt-resources/dist",
        },
        {
          src: "node_modules/dwt/dist/dynamsoft.webtwain.min.js",
          dest: "dwt-resources",
        },
      ],
    }),
  ],
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
