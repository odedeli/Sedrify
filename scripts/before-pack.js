// ─────────────────────────────────────────────────────────────────────────────
// Sedrify — before-pack hook
// Copies native module dependencies that pnpm stores separately into
// node_modules/ so electron-builder bundles them correctly.
// ─────────────────────────────────────────────────────────────────────────────

const { cpSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

exports.default = async function(context) {
  const root = context.appOutDir
    ? join(context.appOutDir, '..', '..', '..')  // appOutDir is dist/linux-unpacked
    : process.cwd()

  const projectRoot = process.cwd()
  const pnpmStore = join(projectRoot, 'node_modules', '.pnpm')
  const targetModules = join(projectRoot, 'node_modules')

  // Packages that better-sqlite3 needs but pnpm stores separately
  const needed = [
    { name: 'bindings', pattern: 'bindings@1' },
    { name: 'file-uri-to-path', pattern: 'file-uri-to-path@1' },
  ]

  for (const pkg of needed) {
    const target = join(targetModules, pkg.name)
    if (existsSync(target)) {
      console.log(`[before-pack] ${pkg.name} already in node_modules`)
      continue
    }

    // Find in pnpm store
    const { readdirSync } = require('fs')
    let found = false
    try {
      const entries = readdirSync(pnpmStore)
      const match = entries.find(e => e.startsWith(pkg.pattern))
      if (match) {
        const src = join(pnpmStore, match, 'node_modules', pkg.name)
        if (existsSync(src)) {
          cpSync(src, target, { recursive: true })
          console.log(`[before-pack] Copied ${pkg.name} from pnpm store`)
          found = true
        }
      }
    } catch (e) {
      console.warn(`[before-pack] Could not find ${pkg.name}:`, e.message)
    }

    if (!found) {
      console.warn(`[before-pack] WARNING: ${pkg.name} not found — build may fail`)
    }
  }
}
