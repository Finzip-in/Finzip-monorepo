'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Dashboard() {
  const { user, session, isLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      console.log('No user found, redirecting to sign in');
      window.location.href = '/auth/signin';
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-blue-600">Dashboard</h1>
        <div className="space-y-4">
          <p className="text-lg font-semibold text-gray-800">Welcome, {user.email}!</p>
          <div className="bg-gray-200 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-gray-700">User Information</h2>
            <p className="text-gray-600"><span className="font-medium">User ID:</span> {user.id}</p>
            <p className="text-gray-600"><span className="font-medium">Email:</span> {user.email}</p>
            <p className="text-gray-600"><span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleString()}</p>
            {session && (
              <p className="text-gray-600"><span className="font-medium">Session Expires:</span> {new Date(session.expires_at! * 1000).toLocaleString()}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 border border-transparent rounded-md shadow-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 