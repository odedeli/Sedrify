const { copyFileSync, mkdirSync, existsSync } = require('fs')
const { join } = require('path')

const src = join(__dirname, '../node_modules/.pnpm/better-sqlite3@11.9.1/node_modules/better-sqlite3/build/Release/better_sqlite3.node')
const dest = join(__dirname, '../node_modules/.pnpm/better-sqlite3@11.9.1/node_modules/better-sqlite3/build/Release/better_sqlite3_electron.node')

if (!existsSync(src)) {
  console.error('Source binary not found:', src)
  process.exit(1)
}
copyFileSync(src, dest)
console.log('Saved Electron binary to', dest)
