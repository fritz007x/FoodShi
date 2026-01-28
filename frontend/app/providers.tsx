'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import { config } from '@/lib/wagmi';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { token, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const { data } = await authApi.getMe();
          setUser(data.user);
        } catch {
          setUser(null);
        }
      } else {
        setLoading(false);
      }
    }

    loadUser();
  }, [token, setUser, setLoading]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: '#16a34a',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          <AuthProvider>
            {mounted && children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#333',
                  color: '#fff',
                },
              }}
            />
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
