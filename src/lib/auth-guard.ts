/**
 * API route authentication guard.
 * Wrap any API handler with this to require a valid session.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      session: null,
    };
  }

  return { authorized: true, response: null, session };
}

/**
 * Higher-order function to protect an API route handler.
 * Usage: export const POST = withAuth(handler);
 */
type HandlerFunction = (...args: any[]) => Promise<Response>;

export function withAuth(handler: HandlerFunction): HandlerFunction {
  return async (...args) => {
    const { authorized, response } = await requireAuth(args[0] as NextRequest);
    if (!authorized || response) return response;
    return handler(...args);
  };
}
