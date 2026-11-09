import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths let the production build run from any folder or sub-path.
  base: './',
  server: { port: 5173, strictPort: false },
  build: {
    target: 'es2022',
    // Rapier inlines its WASM and Three.js is large on its own, so the default warning is just noise here.
    chunkSizeWarningLimit: 6000,
  },
  test: {
    // Only the pure logic layer is unit-tested, so no browser or DOM emulation is needed.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
