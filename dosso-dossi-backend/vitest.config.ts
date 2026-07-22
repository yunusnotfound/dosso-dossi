import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testler paylaşılan bir test veritabanı kullanır → seri çalıştır
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
