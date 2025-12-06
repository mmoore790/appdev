import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendUrl =
  process.env.VITE_BACKEND_URL ??
  process.env.BACKEND_URL ??
  "http://localhost:3001";

export default defineConfig({
  // 1. Removed all Replit-specific plugins
  plugins: [react()],
  
  // 2. 'root' is 'frontend/src' (where your index.html is)
  root: path.resolve(__dirname, "src"),
  
  resolve: {
    alias: {
      // 3. '@' alias points to your *actual* code: 'frontend/src/src'
      "@": path.resolve(__dirname, "src", "src"),
      
      // 4. '@assets' alias points to your assets folder
      "@assets": path.resolve(__dirname, "src", "src", "assets"),
      
      // 5. '@shared' alias points to your BACKEND schema folder
      "@shared": path.resolve(__dirname, "..", "backend", "src", "shared"),
    },
  },

  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
  build: {
    // 6. Build output will be in 'frontend/dist' (relative to vite.config.ts location, not root)
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
