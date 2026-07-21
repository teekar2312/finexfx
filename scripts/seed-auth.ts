// Seed script — creates the default admin user if no users exist.
// Run with: bun run seed:auth
//
// SECURITY: The admin password is randomly generated on each run and printed
// once to stdout. Copy it immediately — it is NOT stored in plaintext anywhere.
// Change it after first login via Settings → User Management → Reset Password.

import { db } from '../src/lib/db'
import { hashPassword, createUser } from '../src/lib/auth'
import { randomBytes } from 'crypto'

function generatePassword(): string {
  // Generate a 16-char alphanumeric password
  const bytes = randomBytes(12)
  return bytes.toString('base64').replace(/[+/=]/g, '').slice(0, 16)
}

async function main() {
  console.log('🔐 Seeding default admin user...')

  const existing = await db.user.count()
  if (existing > 0) {
    console.log(`✅ ${existing} user(s) already exist — skipping seed.`)
    return
  }

  const password = generatePassword()
  const admin = await createUser({
    email: 'admin@finexfx.local',
    name: 'Administrator',
    password,
    role: 'admin',
  })

  console.log('✅ Default admin user created:')
  console.log(`   Email:    ${admin.email}`)
  console.log(`   Name:     ${admin.name}`)
  console.log(`   Role:     ${admin.role}`)
  console.log(`   Password: ${password}`)
  console.log('')
  console.log('⚠️  IMPORTANT: Copy this password now — it will NOT be shown again.')
  console.log('   Change it after first login: Settings → User Management → Reset Password')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
