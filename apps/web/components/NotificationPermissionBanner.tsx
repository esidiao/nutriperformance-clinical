'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

const DISMISSED_KEY = 'np_notif_banner_dismissed';

export function NotificationPermissionBanner() {
  const { permission, isRequesting, requestPermission, isSupported } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
  }, []);

  // Don't show if: not supported, already granted/denied, or dismissed
  if (!isSupported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleAllow = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      toast.success('Notificações ativadas! Você receberá alertas de pacientes críticos.');
      setDismissed(true);
    } else {
      toast.info('Notificações bloqueadas. Você pode ativar a qualquer momento nas configurações do navegador.');
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl">
      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
        <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Ativar notificações</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-snug">
          Receba alertas imediatos sobre pacientes com situações críticas, mesmo com o app em segundo plano.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleAllow}
          disabled={isRequesting}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {isRequesting ? 'Aguarde...' : 'Ativar'}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
