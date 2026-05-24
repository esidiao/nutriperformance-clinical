'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        flex items-center gap-2 rounded-lg transition-colors
        ${compact
          ? 'p-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
          : 'px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 w-full'
        }
      `}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark
        ? <Sun className="h-4 w-4 flex-shrink-0" />
        : <Moon className="h-4 w-4 flex-shrink-0" />
      }
      {!compact && <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>}
    </button>
  );
}
