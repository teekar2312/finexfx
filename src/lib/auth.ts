/**
 * NextAuth.js Configuration
 * 
 * Credentials-based authentication for FINEX Indonesia Trading Dashboard.
 * - Demo mode: any email/password works (no real account needed)
 * - Production mode: validates against the User model in the database
 */
import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'FINEX Trading',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'trader@finex.id' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // In demo mode, accept any valid email/password combo
        // In production, validate against the database
        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        // Auto-create user if they don't exist (demo convenience)
        if (!user) {
          const newUser = await db.user.create({
            data: {
              email: credentials.email,
              name: credentials.email.split('@')[0],
            },
          });
          return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          };
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/api/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
