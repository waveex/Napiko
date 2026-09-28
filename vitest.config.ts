import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup-env.ts'],
    // Testy integracyjne dzielą jedną bazę testową – uruchamiamy pliki po kolei.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
