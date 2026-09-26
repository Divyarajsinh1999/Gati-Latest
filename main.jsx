import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { SplashScreen } from './components/layout/SplashScreen.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * THE SPLASH IS A SIBLING OF THE ROUTER, NOT A WRAPPER AROUND IT.
 *
 * Rendered here rather than inside AppShell for two reasons. It must mount
 * exactly once per launch — inside a route element it would replay on every
 * navigation. And it must not gate anything: as a sibling, the router
 * mounts, resolves and starts fetching on the very same frame, entirely
 * unaware that something is drawn on top of it. Deleting this line changes
 * when the app becomes visible and never when it becomes ready.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <SplashScreen />
    </QueryClientProvider>
  </StrictMode>,
);
