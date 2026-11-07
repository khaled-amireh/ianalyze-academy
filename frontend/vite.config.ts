import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep fonts on our origin: the production CSP intentionally excludes data: fonts.
  build: {
    assetsInlineLimit: (filePath) => (/\.(?:woff2?|ttf|otf)$/i.test(filePath) ? false : undefined),
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/artifacts/**'] },
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
});
