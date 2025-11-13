import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      buffer: 'buffer/',
      stream: 'stream-browserify',
      util: 'util/',
    }
  },

  define: {
    global: 'globalThis',
  },

  optimizeDeps: {
    include: ['buffer', 'stream-browserify', 'util'],
  }
});
