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
        // Redirect to sign up page with error
        return NextResponse.redirect(new URL('/auth/signup?error=verification_failed', request.url));
      } else {
        console.log('Auth callback: Code exchanged for session successfully');
        console.log('User:', data.user?.email);
        
        // Check if this is a new user (no phone number yet)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('phone')
          .eq('user_id', data.user?.id)
          .single();

        if (!userData?.phone) {
          // New user, redirect to verify-email page to collect phone number
          return NextResponse.redirect(new URL('/auth/verify-email', request.url));
        } else {
          // Existing user with phone number, redirect to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      }
    } catch (error) {
      console.error('Auth callback: Exception exchanging code for session:', error);
      return NextResponse.redirect(new URL('/auth/signup?error=verification_failed', request.url));
    }
  }

  // If no code is present, redirect to sign up page
  return NextResponse.redirect(new URL('/auth/signup', request.url));
} 