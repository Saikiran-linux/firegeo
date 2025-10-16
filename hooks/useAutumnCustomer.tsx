'use client';

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useCustomer as useAutumnCustomer, UseCustomerParams } from 'autumn-js/react';

// Create a context for the refetch function
interface AutumnCustomerContextType {
  refetchCustomer: () => Promise<void>;
}

const AutumnCustomerContext = createContext<AutumnCustomerContextType | null>(null);

// Inner provider that uses the autumn hook
function AutumnCustomerProviderInner({ children }: { children: ReactNode }) {
  const { refetch } = useAutumnCustomer({ skip: true });

  const refetchCustomer = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <AutumnCustomerContext.Provider value={{ refetchCustomer }}>
      {children}
    </AutumnCustomerContext.Provider>
  );
}

// Provider component - now just passes through to the inner provider
export function AutumnCustomerProvider({ children }: { children: ReactNode }) {
  return (
    <AutumnCustomerProviderInner>
      {children}
    </AutumnCustomerProviderInner>
  );
}

// Hook to use the customer data with global refetch
export function useCustomer(params?: UseCustomerParams) {
  const autumnCustomer = useAutumnCustomer(params);
  const context = useContext(AutumnCustomerContext);

  // Create a wrapped refetch that can be used globally
  const globalRefetch = useCallback(async () => {
    // Refetch the local instance
    const result = await autumnCustomer.refetch();
    
    // Also trigger any global refetch if in context
    if (context?.refetchCustomer) {
      await context.refetchCustomer();
    }
    
    return result;
  }, [autumnCustomer, context]);

  return {
    ...autumnCustomer,
    refetch: globalRefetch,
  };
}

// Hook to trigger a global customer data refresh from anywhere
export function useRefreshCustomer() {
  const context = useContext(AutumnCustomerContext);
  
  if (!context) {
    // Return a no-op function if not in provider
    return async () => {
      console.warn('useRefreshCustomer called outside of AutumnCustomerProvider');
    };
  }
  
  return context.refetchCustomer;
}