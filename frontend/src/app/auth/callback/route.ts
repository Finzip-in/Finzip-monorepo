import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  console.log('Auth callback: Code received:', code ? 'yes' : 'no');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Auth callback: Error exchanging code for session:', error);
      } else {
        console.log('Auth callback: Code exchanged for session successfully');
        console.log('User:', data.user?.email);
        console.log('JWT Token:', data.session?.access_token.substring(0, 15) + '...');
      }
    } catch (error) {
      console.error('Auth callback: Exception exchanging code for session:', error);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/dashboard', request.url));
} 