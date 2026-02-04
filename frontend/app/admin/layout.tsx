'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import React from 'react';

// Memoized navigation component
const AdminNav = React.memo(() => (
  <nav className="hidden md:flex items-center space-x-6">
    <Link href="/admin" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
      Dashboard
    </Link>
    <Link href="/admin/webinars" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
      Webinars
    </Link>
  </nav>
));
AdminNav.displayName = 'AdminNav';

// Memoized logo component
const Logo = React.memo(() => (
  <Link href="/admin" className="flex items-center space-x-2">
    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
      <span className="text-white font-bold">W</span>
    </div>
    <span className="font-semibold">Webinar Admin</span>
  </Link>
));
Logo.displayName = 'Logo';

// Memoized user menu
const UserMenu = React.memo(({ email, onLogout }: { email: string; onLogout: () => void }) => (
  <div className="flex items-center space-x-4">
    <span className="text-sm text-gray-600">{email}</span>
    <button
      onClick={onLogout}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      Logout
    </button>
  </div>
));
UserMenu.displayName = 'UserMenu';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-8">
            <Logo />
            <AdminNav />
          </div>
          <UserMenu email={user.email} onLogout={handleLogout} />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
