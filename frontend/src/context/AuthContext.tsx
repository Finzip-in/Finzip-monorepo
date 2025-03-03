'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Create the Supabase client directly in this file to avoid server/client mismatches
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, phone: string) => Promise<{ error: any }>;
  signIn: (identifier: string, password: string) => Promise<{ error: any, data?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
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
        
        // If user just signed in, redirect to dashboard
        if (event === 'SIGNED_IN' && window.location.pathname !== '/dashboard') {
          console.log('User signed in, redirecting to dashboard');
          router.push('/dashboard');
        }
        
        // If user just signed out, redirect to home
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, redirecting to home');
          router.push('/');
        }
      }
    );

    // Initial session fetch
    console.log('AuthProvider: Fetching initial session');
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // If user is already signed in and not on dashboard, redirect to dashboard
      if (session && window.location.pathname !== '/dashboard') {
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
            user_id: authData.user.id,
            email: email,
            phone: phone
          }
        ]);

      if (insertError) {
        console.error('Error inserting user data:', insertError);
        // If inserting fails, we should probably delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
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
      
      // If the identifier is not an email (doesn't contain @), assume it's a phone number
      if (!identifier.includes('@')) {
        // Query the users table to get the email associated with this phone number
        const { data: userData, error: queryError } = await supabase
          .from('users')
          .select('email')
          .eq('phone', identifier)
          .single();

        if (queryError || !userData) {
          console.error('Error finding user by phone:', queryError);
          return { error: new Error('No user found with this phone number') };
        }

        email = userData.email;
      }

      // Now sign in with the email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }
      
      console.log('Sign in successful:', data.user?.email);
      console.log('JWT Token:', data.session?.access_token.substring(0, 15) + '...');
      
      // Store the session and user in state
      setSession(data.session);
      setUser(data.user);
      
      // Force a hard navigation to dashboard
      window.location.href = '/dashboard';
      
      return { data, error: null };
    } catch (error) {
      console.error('Unexpected error during sign in:', error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('AuthContext: Signing out');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
    } else {
      // Clear the session and user from state
      setSession(null);
      setUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    console.log('AuthContext: Resetting password for email:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    console.log('Reset password result:', error);
    return { error };
  };

  const value = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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