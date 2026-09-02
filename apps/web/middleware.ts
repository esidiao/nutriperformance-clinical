import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Rotas PÚBLICAS. Tudo que não estiver aqui exige sessão.
//
// A lista era ao contrário — enumerava o que proteger — e o efeito era que
// toda página nova nascia desprotegida até alguém lembrar de acrescentá-la.
// /agenda, /meal-plans e /financeiro tinham ficado de fora exatamente assim:
// a API recusava os dados, mas a casca da página abria para quem não estava
// logado e não havia redirecionamento para o login. Invertido, esquecer de
// listar passa a pecar para o lado seguro — a página pede login à toa, em vez
// de abrir sem pedir.
const PUBLIC_PREFIXES = [
  '/login',
  '/auth',            // login, register, reset-password e callback
  '/legal',           // privacidade, termos, cookies, dados
  '/responder',       // anamnese pré-consulta: o paciente não tem conta
  '/diario',          // diário alimentar: idem — o acesso é o token do link
  '/portal',          // portal do paciente: o token do link é a credencial
];

// Admin-only prefixes — require role === 'admin' in addition to a valid session
const ADMIN_PREFIXES = ['/admin'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true; // raiz decide para onde mandar
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Validate a `next` redirect target:
 * - Must start with exactly one `/` (relative path)
 * - Must NOT start with `//` (protocol-relative URLs like //evil.com)
 * - Must NOT contain a protocol scheme (e.g. https:)
 */
function isSafeRedirect(next: string | null): boolean {
  if (!next) return false;
  return next.startsWith('/') && !next.startsWith('//') && !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(next);
}

export async function middleware(request: NextRequest) {
  // Decode and normalize the pathname to prevent encoded path bypass attacks
  // e.g. %2Fdashboard or /dashboard/../admin should still match protected prefixes.
  const rawPathname = request.nextUrl.pathname;
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    pathname = rawPathname;
  }
  // Normalize repeated slashes and dot-segments
  pathname = pathname.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

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

  // 'unsafe-eval' is required by Next.js HMR in development but must NOT be
  // included in production builds where it would allow arbitrary code execution.
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  // A allowlist do connect-src precisa conter a API. Em produção é o serviço do
  // Render; em desenvolvimento a API sobe em localhost:3001, que a CSP bloqueava
  // — todo fetch local falhava com "Refused to connect", inclusive o warm-up.
  const apiOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_API_URL;
    if (!raw) return null;
    try { return new URL(raw).origin; } catch { return null; }
  })();

  const connectSrc = [
    "connect-src 'self'",
    'https://*.supabase.co',
    'https://supabase.io',
    'wss://*.supabase.co',
    // Host real da API em produção. Já esteve como `nutriperformance-api`, que
    // NÃO existe: o CSP só não quebrava porque NEXT_PUBLIC_API_URL entrava na
    // linha de baixo. Sem essa env, o connect-src liberava apenas um host morto
    // e toda chamada à API virava violação de CSP.
    'https://nutriperformance-clinical.onrender.com',
    ...(apiOrigin && apiOrigin !== 'https://nutriperformance-clinical.onrender.com' ? [apiOrigin] : []),
  ].join(' ');

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://dgvrflipjxaclpmudtwt.supabase.co",
      connectSrc,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  // ── Route protection ─────────────────────────────────────────────────────────
  if (isPublic(pathname)) {
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
    // NOTE: @supabase/ssr@0.3.x exposes the get/set/remove cookie interface.
    // The getAll/setAll interface only exists from 0.4.0 onward — using it with
    // 0.3.0 silently read zero cookies, so getSession() always returned null and
    // every protected route bounced back to /login. Match the installed API.
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          response.cookies.set({ name, value: '', ...options });
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
    // Only pass `next` if it's a safe relative path to prevent open-redirect abuse.
    if (isSafeRedirect(pathname)) {
      loginUrl.searchParams.set('next', pathname);
    }
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
