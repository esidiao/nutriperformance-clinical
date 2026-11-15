import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// ============================================================================
// Verificação do token, pela MESMA técnica da API
// ----------------------------------------------------------------------------
// `supabase.auth.getSession()` lê a sessão do cookie e NÃO valida a assinatura
// do JWT — é por isso que a própria Supabase recomenda não confiar nele no
// servidor. Enquanto o papel saía dali, duas coisas passavam:
//
//   1. cookie forjado com qualquer conteúdo, porque ninguém conferia a
//      assinatura;
//   2. `role` lido de `user_metadata` como alternativa — e `user_metadata` é
//      gravável pelo PRÓPRIO dono do token (`updateUser({ data })`). Bastava a
//      pessoa se promover a admin em si mesma.
//
// A segunda é a mesma escalada de privilégio que o `JwtAuthGuard` da API
// fechou em 12/09/2026; a casca do front ficou para trás.
//
// O dado em si nunca esteve exposto: ele vem da API, que verifica por JWKS e,
// desde 30/10/2026, também confere `is_active`. O que passava era a CASCA da
// página — um controle que não controlava.
//
// Verificar aqui, e não subir o `@supabase/ssr` de 0.3 para 0.5, é escolha:
// a troca de versão mexe na interface de cookies (`get/set/remove` para
// `getAll/setAll`) e já derrubou o login inteiro deste projeto uma vez, com o
// sintoma de "ninguém entra". Isto reaproveita uma técnica já em produção na
// API, sem tocar no fluxo de sessão.
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

// `jose` mantém o JWKS em cache e o renova sozinho; roda no runtime edge.
const JWKS = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

/**
 * Devolve os claims VERIFICADOS, ou `null`.
 *
 * Falha fechado em tudo: sem JWKS configurado, assinatura inválida, token
 * expirado ou erro de rede, devolve `null` e a pessoa vai para o login. O
 * preço de falhar fechado aqui é um login a mais; o de falhar aberto é aceitar
 * cookie forjado.
 */
async function verificarToken(token: string | undefined): Promise<JWTPayload | null> {
  if (!token || !JWKS) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, { audience: 'authenticated' });
    return payload;
  } catch {
    return null;
  }
}

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
  // Identificação do build (`app/api/versao`). Precisa ser pública pelo mesmo
  // motivo que o `/health` da API é: serve para conferir o deploy DE FORA,
  // antes de ter sessão. Só devolve identificadores de build.
  '/api/versao',
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

  // ============================================================================
  // Nonce por requisição no lugar de `script-src 'unsafe-inline'`
  // ----------------------------------------------------------------------------
  // `'unsafe-inline'` em script-src anula a CSP como defesa contra XSS: qualquer
  // `<script>` que entrasse no HTML executaria. Era a última permissão larga que
  // sobrava aqui.
  //
  // O nonce é um valor aleatório por requisição que vai em DOIS lugares:
  //
  //   1. no header da RESPOSTA, onde o navegador o lê e passa a exigir
  //      `nonce="..."` em cada script;
  //   2. no header da REQUISIÇÃO, de onde o Next 15 o extrai
  //      (`getScriptNonceFromHeader`) e o escreve em cada script que ele mesmo
  //      emite — bootstrap, chunks e payload RSC.
  //
  // Sem o passo 2 o app morre inteiro: o HTML sai sem nonce e o navegador
  // bloqueia a própria hidratação do Next, com a página em branco.
  //
  // `'strict-dynamic'` existe porque o webpack cria tags <script> em tempo de
  // execução para carregar chunks; ele autoriza o que um script já confiável
  // carrega. Com ele presente, `'self'` e lista de hosts deixam de valer para
  // script — fica só o nonce. `'self'` continua escrito para navegador antigo
  // que não entende `'strict-dynamic'`.
  //
  // CONSEQUÊNCIA QUE NÃO DÁ PARA CONTORNAR: nonce é por requisição, e página
  // pré-renderizada tem HTML fixo do build. Antes disto, 38 das 45 rotas eram
  // estáticas, com 9 scripts inline sem nonce gravados no HTML — todas
  // morreriam. Ler `x-nonce` no layout raiz (`app/layout.tsx`) torna TODAS as
  // rotas dinâmicas, que é o preço disto. Custa pouco neste app porque as
  // páginas são cascas de componente de cliente: os dados vêm da API pelo
  // react-query, então o render do servidor não toca banco.
  //
  // `style-src` MANTÉM `'unsafe-inline'`, de propósito: `next/font` injeta
  // <style> e os componentes usam atributo `style=`. Estilo inline é alavanca
  // muito menor que script, e trocá-lo aqui quebraria a tipografia do app.
  // ============================================================================
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));

  // 'unsafe-eval' is required by Next.js HMR in development but must NOT be
  // included in production builds where it would allow arbitrary code execution.
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

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

  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://dgvrflipjxaclpmudtwt.supabase.co",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // ── Security headers on every response ──────────────────────────────────────
  // A requisição segue com o nonce para o renderizador: `Content-Security-Policy`
  // é o header que o Next lê para achá-lo, e `x-nonce` é o que o layout raiz lê
  // para repassá-lo a componente que emite script próprio (o do next-themes).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
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
  // Do que vem do cookie, só o token interessa: identidade e papel saem dos
  // claims verificados, nunca do objeto que `getSession()` monta.
  let session: { access_token?: string } | null = null;

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

  // O cookie diz que há sessão; só a assinatura prova. Daqui para baixo, nada
  // mais lê `session` — o que vale são os claims verificados.
  const claims = await verificarToken(session?.access_token);

  if (!claims) {
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
    // SÓ `app_metadata`, e sem alternativa. `user_metadata` é gravável pelo
    // dono do token: aceitá-lo como segunda opção era dar a qualquer conta o
    // caminho de se promover a admin em si mesma.
    const meta = (claims.app_metadata as Record<string, unknown> | undefined) ?? {};
    const role = meta.role as string | undefined;
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
