import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Scrape runs Puppeteer for ~60-90s per provider. Default proxy timeout
        // (~30s) cuts the connection mid-scrape and surfaces as a cryptic
        // "string did not match the expected pattern" fetch error in Safari.
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
