'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Hide navbar and footer for dashboard and app routes
  const isDashboardRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/brand-monitor') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/autumn-verify');

  return (
    <div className="flex flex-col min-h-screen">
      {!isDashboardRoute && <Navbar />}
      <main className="flex-grow">
        {children}
      </main>
      {!isDashboardRoute && <Footer />}
    </div>
  );
}
