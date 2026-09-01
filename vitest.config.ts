import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['foundation/__tests__/**/*.test.ts'],
    globals: true,
    // Use a separate pool so better-sqlite3 loads fresh each run
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@foundation': resolve(__dirname, 'foundation')
    }
  }
})
