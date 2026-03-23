/**
 * Demo mode configuration
 * When VITE_DEMO_MODE is true, the app runs without authentication
 */

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export const demoUser = {
  name: 'Demo User',
  email: 'demo@casazen.com',
  picture: 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff',
};

console.log('🎭 Demo mode:', isDemoMode ? 'ENABLED' : 'DISABLED');
