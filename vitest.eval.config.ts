import { defineConfig } from 'vitest/config';

// Live AI answer-quality check (calls the running assistant server; costs API credit).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.eval.ts'], testTimeout: 90_000, hookTimeout: 20_000 },
});
