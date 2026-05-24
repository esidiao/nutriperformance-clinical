'use client';

import { useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export type AuditAction =
  | 'VIEW_PATIENT' | 'CREATE_PATIENT' | 'UPDATE_PATIENT' | 'DELETE_PATIENT'
  | 'CREATE_ASSESSMENT' | 'VIEW_ASSESSMENT' | 'DELETE_ASSESSMENT'
  | 'CREATE_INTERACTION_ANALYSIS' | 'CREATE_BIOAVAILABILITY_ANALYSIS'
  | 'CREATE_LAB_EXAM' | 'CREATE_REPORT' | 'EXPORT_PDF'
  | 'VIEW_ADMIN' | 'ADJUST_TOKENS';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to log clinical actions to the audit_logs table (LGPD compliance).
 * Fails silently — audit logging must never block clinical workflow.
 */
export function useAuditLog() {
  const log = useCallback(async (entry: AuditEntry) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('audit_logs').insert({
        user_id: session.user.id,
        user_email: session.user.email,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        entity_label: entry.entityLabel ?? null,
        new_data: entry.metadata ?? null,
      });
    } catch {
      // Silently fail — never block clinical workflow
    }
  }, []);

  return { log };
}
