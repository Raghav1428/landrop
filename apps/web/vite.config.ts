import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        ws: true,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (req) =>
            req.setHeader("origin", "http://127.0.0.1:4173"),
          );
          proxy.on("proxyReqWs", (req) =>
            req.setHeader("origin", "http://127.0.0.1:4173"),
          );
        },
      },
    },
  },
  build: { target: "es2022" },
});
