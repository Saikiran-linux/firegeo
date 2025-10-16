'use client';

import { AutumnProvider } from 'autumn-js/react';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AutumnCustomerProvider } from '@/hooks/useAutumnCustomer';
import { useSession } from '@/lib/auth-client';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { GXOProvider, GXOPageViewTracker } from '@/lib/gxo/instrumentation';

function AuthAwareAutumnProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  
  // Always render AutumnProvider to avoid context errors
  // The provider will handle unauthenticated state internally
  return (
    <AutumnProvider
      backendUrl="/api/auth/autumn"
      betterAuthUrl={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
      allowAnonymous={true}
      skipInitialFetch={!session && !isPending}
    >
      <AutumnCustomerProvider>
        {children}
      </AutumnCustomerProvider>
    </AutumnProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="geomization-theme">
      <QueryProvider>
        <GXOProvider>
          <TooltipProvider delayDuration={200}>
            <AuthAwareAutumnProvider>
              <GXOPageViewTracker />
              {children}
            </AuthAwareAutumnProvider>
            <Toaster />
          </TooltipProvider>
        </GXOProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}