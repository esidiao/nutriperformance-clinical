'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission as PermissionState);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<PermissionState> => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') {
      setPermission('granted');
      return 'granted';
    }
    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      return result as PermissionState;
    } finally {
      setIsRequesting(false);
    }
  }, []);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== 'granted') return;
      try {
        new Notification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          ...options,
        });
      } catch {
        // Silently fail if notification API not available
      }
    },
    [permission],
  );

  const notifyCriticalAlert = useCallback(
    (patientCode: string, message: string) => {
      sendNotification(`⚠️ Alerta crítico — ${patientCode}`, {
        body: message,
        tag: `critical-${patientCode}`,
        requireInteraction: true,
      });
    },
    [sendNotification],
  );

  return {
    permission,
    isRequesting,
    requestPermission,
    sendNotification,
    notifyCriticalAlert,
    isSupported: permission !== 'unsupported',
  };
}
