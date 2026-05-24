'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface Shortcut {
  key: string;
  label: string;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(onShowHelp: () => void) {
  const router = useRouter();

  const shortcuts: Omit<Shortcut, 'action'>[] = [
    { key: 'n', label: 'N', description: 'Novo paciente' },
    { key: 'a', label: 'A', description: 'Nova avaliação nutricional' },
    { key: 'f', label: 'F', description: 'Nova avaliação física' },
    { key: 'r', label: 'R', description: 'Novo relatório' },
    { key: 'p', label: 'P', description: 'Lista de pacientes' },
    { key: 'd', label: 'D', description: 'Dashboard' },
    { key: '?', label: '?', description: 'Mostrar atalhos' },
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'n': router.push('/patients/new'); break;
        case 'a': router.push('/assessments/nutritional/new'); break;
        case 'f': router.push('/assessments/physical/new'); break;
        case 'r': router.push('/reports/new'); break;
        case 'p': router.push('/patients'); break;
        case 'd': router.push('/dashboard'); break;
        case '?': onShowHelp(); break;
      }
    },
    [router, onShowHelp],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
}
