'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Create the Supabase client directly in this file to avoid server/client mismatches
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API_URL = 'http://localhost:3001/api';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, phone: string) => Promise<{ error: any }>;
  signIn: (identifier: string, password: string) => Promise<{ error: any, data?: any, requiresOTP?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  verify2FA: (userId: string, otp: string) => Promise<{ error: any, data?: any }>;
  resend2FA: (userId: string, identifier: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('AuthProvider: Setting up auth listener');
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        if (event === 'SIGNED_IN' && !window.location.pathname.includes('/auth/verify-2fa')) {
          console.log('User signed in, redirecting to dashboard');
          router.push('/dashboard');
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, redirecting to home');
          router.push('/');
        }
      }
    );

    console.log('AuthProvider: Fetching initial session');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (session && !window.location.pathname.includes('/auth/verify-2fa') && window.location.pathname !== '/dashboard') {
        console.log('User already signed in, redirecting to dashboard');
        router.push('/dashboard');
      }
    });

    return () => {
      console.log('AuthProvider: Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const signUp = async (email: string, password: string, phone: string) => {
    console.log('AuthContext: Signing up with email:', email);
    
    try {
      // 1. First, sign up the user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        return { error: signUpError };
      }

      if (!authData.user) {
        return { error: new Error('No user data returned after signup') };
      }

      // 2. Then, insert the user's phone number into our custom users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: email,
            phone: phone,
          }
        ]);

      if (insertError) {
        console.error('Error inserting user data:', insertError);
        return { error: insertError };
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected error during sign up:', error);
      return { error };
    }
  };

  const signIn = async (identifier: string, password: string) => {
    console.log('AuthContext: Signing in with identifier:', identifier);
    try {
      let email = identifier;
      
      // If identifier is a phone number, get the associated email
      if (!identifier.includes('@')) {
        console.log('Phone number detected, looking up associated email');
        const { data: userData, error: queryError } = await supabase
          .from('users')
          .select('email')
          .eq('phone', identifier)
          .single();

        if (queryError || !userData) {
          console.error('No user found with this phone number:', queryError);
          return { error: new Error('No user found with this phone number') };
        }
        email = userData.email;
        console.log('Found email for phone number:', email);
      }

      // Store credentials for later use after OTP verification
      sessionStorage.setItem('temp_email', email);
      sessionStorage.setItem('temp_password', password);
      sessionStorage.setItem('temp_identifier', identifier);

      console.log('Stored credentials in session storage');

      // Generate and send OTP
      console.log('Sending OTP generation request to API');
      try {
        const response = await fetch(`${API_URL}/otp/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: email, // Using email as userId
            identifier: identifier
          })
        });

        const otpResult = await response.json();
        console.log('OTP generation response:', otpResult);
        
        if (!response.ok) {
          console.error('OTP generation failed:', otpResult.error);
          return { error: new Error(otpResult.error || 'Failed to generate OTP') };
        }

        console.log('OTP generated successfully, returning data for redirection');
        return { 
          error: null, 
          data: { userId: email },
          requiresOTP: true 
        };
      } catch (apiError: any) {
        console.error('API error during OTP generation:', apiError);
        return { error: new Error('Failed to connect to authentication service. Please try again.') };
      }
    } catch (error: any) {
      console.error('Unexpected error during sign in:', error);
      return { error: new Error(error.message || 'An unexpected error occurred') };
    }
  };

  const verify2FA = async (userId: string, otp: string) => {
    try {
      // Verify OTP
      const response = await fetch(`${API_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp })
      });

      const result = await response.json();
      if (!response.ok) {
        return { error: new Error(result.error) };
      }

      if (!result.verified) {
        return { error: new Error('Invalid or expired OTP') };
      }

      // Get stored credentials
      const email = sessionStorage.getItem('temp_email');
      const password = sessionStorage.getItem('temp_password');

      if (!email || !password) {
        return { error: new Error('Session expired. Please sign in again.') };
      }

      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Clean up stored credentials
      sessionStorage.removeItem('temp_email');
      sessionStorage.removeItem('temp_password');
      sessionStorage.removeItem('temp_identifier');

      if (signInError) {
        console.error('Sign in error after 2FA:', signInError);
        return { error: new Error('Failed to create session') };
      }

      setSession(data.session);
      setUser(data.user);

      return { error: null, data: { verified: true } };
    } catch (error) {
      console.error('Error in verify2FA:', error);
      return { error };
    }
  };

  const resend2FA = async (userId: string, identifier: string) => {
    try {
      const response = await fetch(`${API_URL}/otp/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, identifier })
      });

      const result = await response.json();
      if (!response.ok) {
        return { error: new Error(result.error) };
      }

      return { error: null };
    } catch (error) {
      console.error('Error in resend2FA:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      return { error };
    } catch (error) {
      console.error('Error resetting password:', error);
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        verify2FA,
        resend2FA,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Export supabase client for direct use
export { supabase }; 