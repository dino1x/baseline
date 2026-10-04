// Vitest runner configuration for Baseline academic verification circuits
import { defineConfig as configureTestSuite } from 'vitest/config';

export default configureTestSuite({
  test: {
    pool: 'forks',
    fileParallelism: false,
    environment: 'node',
    globals: true,
    include: [
      'tests/contract/**/*.test.ts',
      'tests/domain/**/*.test.ts',
    ],
  },
});
