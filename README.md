# Sedrify

Personal, offline-first database builder for the Linux desktop.

**Stack:** React · TypeScript · Electron · better-sqlite3 · Vite  
**Version:** 0.0.1 (Sprint 0 — Scaffold)  
**RFD:** RFD-SED-001 v0.2

---

## Prerequisites

- Node.js 18 or higher
- pnpm (`npm install -g pnpm`)
- Git

## Setup

```bash
# Clone or extract the project
cd ~/Development/sedrify

# Install dependencies
pnpm install

# Run tests (must pass before any other command)
pnpm test

# Start development mode (opens Electron window)
pnpm dev
```

## Project Structure

```
sedrify/
├── src/
│   ├── main/          # Electron main process (Node.js)
│   ├── preload/       # Electron context bridge
│   └── renderer/      # React application (Chromium)
│       └── index.css  # Design tokens (Appendix C)
├── foundation/        # Layer 1 — pure TypeScript, no React, no Electron
│   └── __tests__/     # Vitest tests
└── modules/           # Layer 3 — feature modules
    ├── cab-explorer/
    ├── cab-designer/
    ├── cab-feeder/
    ├── cab-finder/
    └── cab-analyzer/
```

## Architecture

Three-layer architecture — see RFD-SED-001 Section 3.

- **Foundation** (`/foundation`) — data engine, field types, record engine, plugin contracts. No UI.
- **UI Shell** (`/src/renderer`) — design system, layout, navigation, interaction model. No feature logic.
- **Feature Modules** (`/modules`) — register into Foundation and render into Shell. Independent.

## Working Method

- Sprint deliveries arrive as delta zip files: `sedrify_v<version>_<layer>-<scope>.zip`
- Apply with: `unzip -o ~/Downloads/<zipfile>.zip`
- Run `pnpm test` after every delivery before anything else
- One machine active at a time when sharing via NAS

## Git

```bash
# Before starting work on either machine
git status   # confirm clean state

# Commit format
git commit -m "feat(foundation): add cabinet engine"
```
