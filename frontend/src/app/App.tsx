import { faCompass } from '@fortawesome/free-solid-svg-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CartPage } from '@/modules/cart';
import {
  CatalogPage,
  CategoriesAdminPage,
  ProductDetailPage,
  ProductEditorPage,
  ProductsAdminPage,
} from '@/modules/catalog';
import { LoginPage, RegisterPage, UserDetailPage, UsersAdminPage } from '@/modules/identity';
import { InventoryAdminPage } from '@/modules/inventory';
import { OrderDetailPage, OrdersPage } from '@/modules/ordering';
import { ButtonLink } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/feedback';
import { Toaster } from '@/shared/ui/Toaster';
import { RequireGuest, RequireRole } from './guards';
import { AdminLayout } from './layouts/AdminLayout';
import { AuthLayout, StoreLayout } from './layouts/StoreLayout';
import { queryClient } from './query-client';

function NotFoundPage() {
  return (
    <EmptyState
      icon={faCompass}
      title="Página no encontrada"
      message="La dirección no existe o cambió."
      action={<ButtonLink to="/">Volver a la tienda</ButtonLink>}
    />
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route element={<RequireGuest />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
            </Route>
          </Route>

          <Route element={<StoreLayout />}>
            <Route index element={<CatalogPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />

            <Route element={<RequireRole role="CUSTOMER" />}>
              <Route path="cart" element={<CartPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="admin" element={<RequireRole role="ADMIN" />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="products" replace />} />
              <Route path="products" element={<ProductsAdminPage />} />
              <Route path="products/new" element={<ProductEditorPage />} />
              <Route path="products/:id/edit" element={<ProductEditorPage />} />
              <Route path="categories" element={<CategoriesAdminPage />} />
              <Route path="inventory" element={<InventoryAdminPage />} />
              <Route path="users" element={<UsersAdminPage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
            </Route>
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
