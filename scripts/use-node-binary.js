const { copyFileSync, existsSync } = require('fs')
const { join } = require('path')

const base = join(__dirname, '../node_modules/.pnpm/better-sqlite3@11.9.1/node_modules/better-sqlite3/build/Release')
const nodeBinary = join(base, 'better_sqlite3_node.node')
const target = join(base, 'better_sqlite3.node')

if (!existsSync(nodeBinary)) {
  console.log('No saved Node binary found — run: pnpm rebuild:node')
  process.exit(0) // don't block tests if binary not saved yet
}
copyFileSync(nodeBinary, target)
console.log('Using Node binary (NMV 115)')
