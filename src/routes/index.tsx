import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
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
import { ProfilePage } from '@/features/profile/profile-page';
import { PricingDashboardPage } from '@/features/pricing';
import { PricingHistoryPage } from '@/features/pricing';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties',
    element: (
      <ProtectedRoute>
        <PropertiesPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties/create',
    element: (
      <ProtectedRoute>
        <PropertyCreatePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties/:id',
    element: (
      <ProtectedRoute>
        <PropertyDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties/:id/edit',
    element: (
      <ProtectedRoute>
        <PropertyEditPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties/:id/pricing',
    element: (
      <ProtectedRoute>
        <PricingDashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bookings',
    element: (
      <ProtectedRoute>
        <BookingsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bookings/create',
    element: (
      <ProtectedRoute>
        <BookingCreatePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bookings/calendar',
    element: (
      <ProtectedRoute>
        <CalendarPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bookings/:id',
    element: (
      <ProtectedRoute>
        <BookingDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bookings/:id/edit',
    element: (
      <ProtectedRoute>
        <BookingEditPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payments',
    element: (
      <ProtectedRoute>
        <PaymentsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payments/create',
    element: (
      <ProtectedRoute>
        <PaymentCreatePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payments/revenue',
    element: (
      <ProtectedRoute>
        <RevenuePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/payments/:id',
    element: (
      <ProtectedRoute>
        <PaymentDetailPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/ota',
    element: (
      <ProtectedRoute>
        <OtaPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/ota/create',
    element: (
      <ProtectedRoute>
        <OtaSetupPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/search',
    element: <SearchPage />,
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <ProfilePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/properties/:id/pricing/history',
    element: (
      <ProtectedRoute>
        <PricingHistoryPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
