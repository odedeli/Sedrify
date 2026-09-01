const { copyFileSync, existsSync } = require('fs')
const { join } = require('path')

const base = join(__dirname, '../node_modules/.pnpm/better-sqlite3@11.9.1/node_modules/better-sqlite3/build/Release')
const electronBinary = join(base, 'better_sqlite3_electron.node')
const target = join(base, 'better_sqlite3.node')

if (!existsSync(electronBinary)) {
  console.log('No saved Electron binary found — run: pnpm rebuild:electron')
  process.exit(0) // don't block dev if binary not saved yet
}
copyFileSync(electronBinary, target)
console.log('Using Electron binary (NMV 125)')
