import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If user is signed in and trying to access auth pages, redirect to dashboard
  if (session && (req.nextUrl.pathname.startsWith('/auth'))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // If user is not signed in and trying to access protected pages, redirect to sign in
  /*if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/auth/signin', req.url));
  }*/

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 