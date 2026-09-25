import { z } from 'zod';

// The Content-Security-Policy of the web app (vercel.json) has no 'unsafe-eval'. Zod would otherwise probe
// `new Function()` (a CSP violation report on every page) and compile validators with it; jitless keeps it on the
// plain interpreter. Imported first in main.tsx: the flag is read when a schema is created.
z.config({ jitless: true });
