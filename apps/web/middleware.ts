import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Protected route prefixes — any path starting with these requires an active session
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/patients',
  '/assessments',
  '/supplementation',
  '/laboratory',
  '/interactions',
  '/bioavailability',
  '/goals',
  '/prescriptions',
  '/reports',
  '/tokens',
  '/settings',
  '/admin',
];

// Admin-only prefixes — require role === 'admin' in addition to a valid session
const ADMIN_PREFIXES = ['/admin'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Security headers on every response ──────────────────────────────────────
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed by Next.js dev; tighten in prod if possible
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://dgvrflipjxaclpmudtwt.supabase.co",
      "connect-src 'self' https://*.supabase.co https://supabase.io wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  // ── Route protection ─────────────────────────────────────────────────────────
  if (!isProtected(pathname)) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are missing (CI/local without config), skip auth check
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  // Build a server-side Supabase client that reads/writes cookies
  let session: { user?: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null = null;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data } = await supabase.auth.getSession();
    session = data.session;
  } catch {
    // On error, deny access to protected routes
    session = null;
  }

  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes: enforce role check server-side
  if (isAdminOnly(pathname)) {
    const user = (session as any).user;
    const role = user?.user_metadata?.role ?? user?.app_metadata?.role;
    if (role !== 'admin') {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = '/dashboard';
      return NextResponse.redirect(dashUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static (static files)
     *  - _next/image (image optimisation)
     *  - favicon.ico
     *  - public folder assets (manifest, icons, sw.js, workbox-*)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|icons/|sw\\.js|workbox-).*)',
  ],
};
