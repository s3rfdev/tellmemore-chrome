import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't wipe popup/background from first build
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'TellMeMoreContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
