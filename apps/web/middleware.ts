import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware mínimo — proteção de rotas feita client-side no DashboardLayout
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
