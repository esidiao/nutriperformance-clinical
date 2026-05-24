'use client';

import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: 'D', description: 'Ir para Dashboard' },
  { key: 'P', description: 'Lista de Pacientes' },
  { key: 'N', description: 'Novo Paciente' },
  { key: 'A', description: 'Nova Avaliação Nutricional' },
  { key: 'F', description: 'Nova Avaliação Física' },
  { key: 'R', description: 'Novo Relatório' },
  { key: '?', description: 'Mostrar / ocultar atalhos' },
];

interface ShortcutsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsPanel({ open, onClose }: ShortcutsPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-600" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Atalhos de Teclado</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">{s.description}</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="px-5 pb-4">
          <p className="text-[10px] text-gray-400 text-center">
            Atalhos não funcionam quando um campo de texto está em foco
          </p>
        </div>
      </div>
    </div>
  );
}
