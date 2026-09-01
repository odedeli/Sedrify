// Copies pnpm-isolated native deps into flat node_modules/ for electron-builder
const { cpSync, existsSync, readdirSync } = require('fs')
const { join } = require('path')

const root = process.cwd()
const pnpmStore = join(root, 'node_modules', '.pnpm')
const target = join(root, 'node_modules')

const needed = [
  { name: 'bindings',         pattern: 'bindings@' },
  { name: 'file-uri-to-path', pattern: 'file-uri-to-path@' },
]

for (const pkg of needed) {
  const dest = join(target, pkg.name)
  if (existsSync(dest)) {
    console.log(`✓ ${pkg.name} already present`)
    continue
  }
  try {
    const entries = readdirSync(pnpmStore)
    const match = entries.find(e => e.startsWith(pkg.pattern))
    if (!match) { console.warn(`✗ ${pkg.name} not found in pnpm store`); continue }
    const src = join(pnpmStore, match, 'node_modules', pkg.name)
    if (!existsSync(src)) { console.warn(`✗ ${pkg.name} source path missing: ${src}`); continue }
    cpSync(src, dest, { recursive: true })
    console.log(`✓ Copied ${pkg.name}`)
  } catch (e) {
    console.warn(`✗ ${pkg.name}: ${e.message}`)
  }
}
