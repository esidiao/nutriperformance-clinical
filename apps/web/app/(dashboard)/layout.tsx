'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Users, FlaskConical,
  Pill, GitMerge, Microscope, Target, FileText,
  Coins, Settings, ShieldCheck, Dna, LogOut,
  TrendingUp, Menu, X, Keyboard,
} from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShortcutsPanel } from '@/components/ShortcutsPanel';
import { CommandPalette } from '@/components/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// ─── Nav structure ──────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Visão Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Clínico',
    items: [
      { href: '/patients', label: 'Pacientes', icon: Users },
      { href: '/goals', label: 'Metas', icon: Target },
    ],
  },
  {
    label: 'Avaliações',
    items: [
      { href: '/assessments/nutritional/new', label: 'Nutricional', icon: FlaskConical },
      { href: '/assessments/physical/new', label: 'Física', icon: TrendingUp },
    ],
  },
  {
    label: 'Análises',
    items: [
      { href: '/supplementation', label: 'Suplementação', icon: Pill },
      { href: '/supplementation/suggest', label: 'Protocolo IA', icon: Dna },
      { href: '/interactions/new', label: 'Interações', icon: GitMerge },
      { href: '/bioavailability', label: 'Biodisponibilidade', icon: Dna },
      { href: '/laboratory', label: 'Exames', icon: Microscope },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/reports/new', label: 'Relatórios', icon: FileText },
      { href: '/tokens', label: 'Tokens', icon: Coins },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin', label: 'Admin', icon: ShieldCheck },
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
];

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({
  open, onClose, onShowShortcuts,
}: {
  open: boolean;
  onClose: () => void;
  onShowShortcuts: () => void;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; plan: string } | null>(null);
  const [alertCount] = useState(2);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata;
        setUser({
          name: meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? 'Usuário',
          email: session.user.email ?? '',
          plan: meta?.plan ?? 'Profissional',
        });
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '?';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        flex flex-col transform transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">NP</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">NutriPerformance</p>
              <p className="text-[10px] text-blue-600 font-medium leading-tight tracking-wide uppercase">Clinical</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User */}
        {user && (
          <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium flex-shrink-0">
                {user.plan}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  const hasAlert = item.href === '/patients' && alertCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                      className={`
                        flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all
                        ${isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                        }
                      `}
                    >
                      <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
                      <span className="flex-1">{item.label}</span>
                      {hasAlert && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                          {alertCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <div className="px-2 py-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-100 dark:border-amber-900">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
              <strong>Ferramenta de apoio.</strong> Não substitui avaliação profissional (CFN · CONFEF).
            </p>
          </div>
          <ThemeToggle />
          <button
            onClick={onShowShortcuts}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Keyboard className="h-4 w-4 flex-shrink-0" />
            Atalhos de teclado
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">?</kbd>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sair da conta
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Top bar (mobile) ─────────────────────────────────────────────────────────
function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
      <button onClick={onMenuClick} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">NP</span>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white">NutriPerformance</span>
      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useKeyboardShortcuts(() => setShortcutsOpen(true));

  // Ctrl+K / Cmd+K opens command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onShowShortcuts={() => setShortcutsOpen(true)}
        />
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="page-transition">
            {children}
          </div>
        </main>
        <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      </div>
    </AuthGuard>
  );
}
