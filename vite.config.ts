import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
    },
  },
  build: {
    // Phaser/rexUI を別チャンクへ分離＝アプリ更新時に巨大ベンダーを再DLさせない。
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
    chunkSizeWarningLimit: 3000,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
