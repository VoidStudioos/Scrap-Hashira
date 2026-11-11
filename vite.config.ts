import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'chrome120',
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        popup: 'popup.html',
        offscreen: 'offscreen.html',
        background: 'src/background/index.ts',
      },
      output: { entryFileNames: '[name].js', chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
});
