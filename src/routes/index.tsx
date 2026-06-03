import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ShortStayLayerGuard } from '@/components/auth/short-stay-layer-guard';
import { LongTermAppShell } from '@/components/layout/long-term-app-shell';
import { AdminAppShell } from '@/components/layout/admin-app-shell';
import { AppLayerProvider } from '@/contexts/app-layer-provider';
import { AdminDashboardPage } from '@/features/admin/admin-dashboard-page';
import { AdminUsersPage } from '@/features/admin/admin-users-page';
import { AdminCinPage } from '@/features/admin/admin-cin-page';
import { AdminJobsPage } from '@/features/admin/admin-jobs-page';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { PropertiesPage } from '@/features/properties/properties-page';
import { PropertyCreatePage } from '@/features/properties/property-create-page';
import { PropertyEditPage } from '@/features/properties/property-edit-page';
import { PropertyDetailPage } from '@/features/properties/property-detail-page';
import { BookingsPage } from '@/features/bookings/bookings-page';
import { BookingCreatePage } from '@/features/bookings/booking-create-page';
import { BookingEditPage } from '@/features/bookings/booking-edit-page';
import { BookingDetailPage } from '@/features/bookings/booking-detail-page';
import { CalendarPage } from '@/features/bookings/calendar-page';
import { PaymentsPage } from '@/features/payments/payments-page';
import { PaymentCreatePage } from '@/features/payments/payment-create-page';
import { PaymentDetailPage } from '@/features/payments/payment-detail-page';
import { RevenuePage } from '@/features/payments/revenue-page';
import { OtaPage } from '@/features/ota/ota-page';
import { OtaSetupPage } from '@/features/ota/ota-setup-page';
import { SearchPage } from '@/features/search/search-page';
import { LayerAwareProfilePage } from '@/features/profile/layer-aware-profile-page';
import { PricingDashboardPage } from '@/features/pricing';
import { PricingHistoryPage } from '@/features/pricing';
import { LeasesPage, LeaseCreatePage, LeaseDetailPage } from '@/features/leases';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/search',
    element: <SearchPage />,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayerProvider>
          <Outlet />
        </AppLayerProvider>
      </ProtectedRoute>
    ),
    children: [
      {
        element: <ShortStayLayerGuard />,
        children: [
          {
            path: '/',
            element: <DashboardPage />,
          },
          {
            path: '/properties',
            element: <PropertiesPage />,
          },
          {
            path: '/properties/create',
            element: <PropertyCreatePage />,
          },
          {
            path: '/properties/:id',
            element: <PropertyDetailPage />,
          },
          {
            path: '/properties/:id/edit',
            element: <PropertyEditPage />,
          },
          {
            path: '/properties/:id/pricing',
            element: <PricingDashboardPage />,
          },
          {
            path: '/properties/:id/pricing/history',
            element: <PricingHistoryPage />,
          },
          {
            path: '/bookings',
            element: <BookingsPage />,
          },
          {
            path: '/bookings/create',
            element: <BookingCreatePage />,
          },
          {
            path: '/bookings/calendar',
            element: <CalendarPage />,
          },
          {
            path: '/bookings/:id',
            element: <BookingDetailPage />,
          },
          {
            path: '/bookings/:id/edit',
            element: <BookingEditPage />,
          },
          {
            path: '/payments',
            element: <PaymentsPage />,
          },
          {
            path: '/payments/create',
            element: <PaymentCreatePage />,
          },
          {
            path: '/payments/revenue',
            element: <RevenuePage />,
          },
          {
            path: '/payments/:id',
            element: <PaymentDetailPage />,
          },
          {
            path: '/ota',
            element: <OtaPage />,
          },
          {
            path: '/ota/create',
            element: <OtaSetupPage />,
          },
        ],
      },
      {
        path: '/profile',
        element: <LayerAwareProfilePage />,
      },
      {
        element: (
          <ProtectedRoute role="LongTermLandlord">
            <LongTermAppShell />
          </ProtectedRoute>
        ),
        children: [
          {
            path: '/leases',
            element: <LeasesPage />,
          },
          {
            path: '/leases/new',
            element: <LeaseCreatePage />,
          },
          {
            path: '/leases/:id',
            element: <LeaseDetailPage />,
          },
        ],
      },
      {
        element: (
          <ProtectedRoute role="Admin">
            <AdminAppShell />
          </ProtectedRoute>
        ),
        children: [
          {
            path: '/admin',
            element: <AdminDashboardPage />,
          },
          {
            path: '/admin/users',
            element: <AdminUsersPage />,
          },
          {
            path: '/admin/cin',
            element: <AdminCinPage />,
          },
          {
            path: '/admin/jobs',
            element: <AdminJobsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
