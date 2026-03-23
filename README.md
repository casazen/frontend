# CASAZEN Frontend

Modern React application for vacation property management, built with React 19, TypeScript, and Tailwind CSS v4.

## Features

- 🏠 **Properties Management** - Complete CRUD for vacation properties with amenities
- 📅 **Bookings** - Booking management with interactive calendar view
- 💳 **Payments** - Payment processing with Stripe, refunds, and revenue analytics
- 🔄 **OTA Integration** - Sync with 6 major platforms (Airbnb, Booking.com, Expedia, VRBO, TripAdvisor, Agoda)
- 🔍 **Search** - Public property search with advanced filters
- 👤 **Profile** - User profile management
- 📊 **Dashboard** - Analytics overview with charts

## Tech Stack

- React 19.2 + TypeScript 5.9 + Vite 8
- Tailwind CSS v4 + Radix UI
- Zustand + TanStack Query v6
- React Hook Form + Zod
- Auth0 for authentication
- React Big Calendar + Recharts

## Getting Started

```bash
npm install
npm run dev
```

Create `.env.local`:
```
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://casazen-api
VITE_API_BASE_URL=http://localhost:3000/api
```

## Build

```bash
npm run build
```
