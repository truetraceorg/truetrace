import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, err) => {
        const e = err as any;
        if (e && typeof e === 'object' && 'status' in e && (e.status === 401 || e.status === 403)) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      onError: (err) => {
        const e = err as any;
        toast.error(e?.message || 'Something went wrong');
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
