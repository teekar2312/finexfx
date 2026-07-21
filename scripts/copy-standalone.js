/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs/promises')
const path = require('path')

async function main() {
  const root = process.cwd()
  const sourceStatic = path.join(root, '.next', 'static')
  const targetStatic = path.join(root, '.next', 'standalone', '.next', 'static')
  const sourcePublic = path.join(root, 'public')
  const targetPublic = path.join(root, '.next', 'standalone', 'public')

  await fs.mkdir(path.dirname(targetStatic), { recursive: true })
  await fs.cp(sourceStatic, targetStatic, { recursive: true })
  await fs.mkdir(path.dirname(targetPublic), { recursive: true })
  await fs.cp(sourcePublic, targetPublic, { recursive: true })

  console.log('Copied .next/static and public into .next/standalone')
}

main().catch((err) => {
  console.error('Failed to copy standalone assets:', err)
  process.exit(1)
})
