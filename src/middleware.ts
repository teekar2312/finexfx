import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    // Match all routes EXCEPT:
    // - /login (auth page)
    // - /api/auth/* (NextAuth endpoints)
    // - /_next/static (static files)
    // - /_next/image (image optimization)
    // - /favicon.ico, /logo.svg
    // - Static assets
    '/((?!login|api/auth|_next/static|_next/image|favicon\\.ico|logo\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
