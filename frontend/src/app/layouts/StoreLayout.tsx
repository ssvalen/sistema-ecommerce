import { useEffect } from 'react';
import { NavigationType, Outlet, useLocation, useNavigationType } from 'react-router';
import { PendingCartAdd } from '@/modules/cart';
import { StoreFooter } from './StoreFooter';
import { StoreHeader } from './StoreHeader';

export function StoreLayout() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  // Con Atrás, el navegador restaura el scroll.
  useEffect(() => {
    if (navigationType !== NavigationType.Pop) window.scrollTo({ top: 0 });
  }, [pathname, search, navigationType]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <StoreHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 lg:py-8">
        <Outlet />
      </main>
      <StoreFooter />
      <PendingCartAdd />
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
}
