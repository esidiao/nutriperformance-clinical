'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users, LayoutDashboard, FlaskConical, TrendingUp,
  FileText, Pill, GitMerge, Dna, Microscope, Target, Coins,
  Settings, ShieldCheck, X, Clock, ArrowRight,
} from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ElementType;
  group: string;
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard',    label: 'Dashboard',                  href: '/dashboard',                        icon: LayoutDashboard, group: 'Navegação' },
  { id: 'patients',     label: 'Pacientes',                  href: '/patients',                         icon: Users,           group: 'Navegação' },
  { id: 'new-patient',  label: 'Novo Paciente',              href: '/patients/new',                     icon: Users,           group: 'Ações',    keywords: ['cadastrar', 'adicionar'] },
  { id: 'nutr-assess',  label: 'Nova Avaliação Nutricional', href: '/assessments/nutritional/new',      icon: FlaskConical,    group: 'Ações',    keywords: ['avaliacao', 'nutricional'] },
  { id: 'phys-assess',  label: 'Nova Avaliação Física',      href: '/assessments/physical/new',         icon: TrendingUp,      group: 'Ações',    keywords: ['avaliacao', 'fisica', 'corporal'] },
  { id: 'interactions', label: 'Analisar Interações',        href: '/interactions/new',                 icon: GitMerge,        group: 'Ações',    keywords: ['interacao', 'suplemento', 'medicamento'] },
  { id: 'bioavail',     label: 'Biodisponibilidade',         href: '/bioavailability',                  icon: Dna,             group: 'Navegação' },
  { id: 'lab',          label: 'Exames Laboratoriais',       href: '/laboratory',                       icon: Microscope,      group: 'Navegação' },
  { id: 'suppl',        label: 'Suplementação',              href: '/supplementation',                  icon: Pill,            group: 'Navegação' },
  { id: 'goals',        label: 'Metas',                      href: '/goals',                            icon: Target,          group: 'Navegação' },
  { id: 'report',       label: 'Gerar Relatório',            href: '/reports/new',                      icon: FileText,        group: 'Ações',    keywords: ['pdf', 'relatorio'] },
  { id: 'tokens',       label: 'Tokens & Assinatura',        href: '/tokens',                           icon: Coins,           group: 'Navegação' },
  { id: 'admin',        label: 'Painel Admin',               href: '/admin',                            icon: ShieldCheck,     group: 'Sistema' },
  { id: 'settings',     label: 'Configurações',              href: '/settings',                         icon: Settings,        group: 'Sistema',  keywords: ['config', 'perfil'] },
];

const RECENT_KEY = 'np_cmd_recent';

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function addRecent(id: string) {
  const prev = getRecent().filter((x) => x !== id).slice(0, 4);
  localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev]));
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setRecent(getRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.trim()
    ? COMMANDS.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.label.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.keywords?.some((k) => k.includes(q))
        );
      })
    : COMMANDS.filter((c) => recent.includes(c.id)).slice(0, 5);

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, c) => {
    const g = query.trim() ? c.group : 'Recentes';
    acc[g] = [...(acc[g] ?? []), c];
    return acc;
  }, {});

  const flat = Object.values(grouped).flat();

  const handleSelect = useCallback((item: CommandItem) => {
    addRecent(item.id);
    router.push(item.href);
    onClose();
  }, [router, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && flat[selected]) handleSelect(flat[selected]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flat, selected, handleSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b dark:border-gray-700">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Buscar página, ação ou paciente..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:flex text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-gray-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {flat.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  {group === 'Recentes' && <Clock className="h-3 w-3" />}
                  {group}
                </div>
                {items.map((item) => {
                  const globalIdx = flat.indexOf(item);
                  const isSelected = globalIdx === selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className={`
                        w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                        ${isSelected ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}
                      `}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <item.icon className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-gray-400 truncate">{item.description}</p>
                        )}
                      </div>
                      {isSelected && <ArrowRight className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Enter</kbd> selecionar</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
