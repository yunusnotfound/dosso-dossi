import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Backend'in ADMIN_ORIGINS allowlist'iyle aynı port
    port: 5173,
    strictPort: true,
  },
});
