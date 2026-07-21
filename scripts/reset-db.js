/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises')
const path = require('path')

async function main() {
  const dbDir = path.join(process.cwd(), 'db')
  try {
    const entries = await fs.readdir(dbDir)
    await Promise.all(entries.map(async (entry) => {
      if (entry === 'custom.db' || entry.startsWith('custom.db-')) {
        await fs.rm(path.join(dbDir, entry), { force: true, recursive: false })
      }
    }))
    console.log('Removed old SQLite database files from db/')
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('db directory not found; skipping cleanup')
      return
    }
    throw err
  }
}

main().catch((err) => {
  console.error('Failed to reset DB:', err)
  process.exit(1)
})
