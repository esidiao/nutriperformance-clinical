import Link from 'next/link';
import {
  LayoutDashboard, Users, FlaskConical, Activity,
  Pill, GitMerge, Microscope, Target, FileText,
  Coins, Settings, ShieldCheck, Dna,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Pacientes', icon: Users },
  {
    label: 'Avaliações',
    icon: FlaskConical,
    children: [
      { href: '/assessments/nutritional/new', label: 'Nutricional' },
      { href: '/assessments/physical/new', label: 'Física' },
    ],
  },
  { href: '/supplementation', label: 'Suplementação', icon: Pill },
  { href: '/interactions/new', label: 'Interações', icon: GitMerge },
  { href: '/bioavailability', label: 'Biodisponibilidade', icon: Dna },
  { href: '/laboratory', label: 'Exames', icon: Microscope },
  { href: '/goals', label: 'Metas', icon: Target },
  { href: '/reports/new', label: 'Relatórios', icon: FileText },
  { href: '/tokens', label: 'Tokens', icon: Coins },
  { href: '/admin', label: 'Admin', icon: ShieldCheck },
  { href: '/settings', label: 'Configurações', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">NP</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">NutriPerformance</p>
              <p className="text-xs text-gray-400 leading-tight">Clinical</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) =>
            'children' in item ? (
              <div key={item.label}>
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="flex items-center gap-2 px-3 py-1.5 ml-3 text-sm text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href!}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-gray-100 hover:text-gray-900"
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t">
          <div className="px-3 py-2 bg-amber-50 rounded-md border border-amber-200">
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Ferramenta de apoio.</strong> Não substitui avaliação profissional.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
