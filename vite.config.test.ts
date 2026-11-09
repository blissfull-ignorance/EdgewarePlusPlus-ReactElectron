import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [react(), renderer()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
