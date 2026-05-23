'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/PageHeader';
import {
  Plus, Search, AlertTriangle, ChevronRight,
  Calendar, Target, Pill, Users,
} from 'lucide-react';

interface Patient {
  id: string;
  internalCode: string;
  name?: string;
  age: number;
  gender: string;
  primaryGoal: string;
  activeAlerts: number;
  alertSeverity: 'none' | 'info' | 'warning' | 'danger' | 'critical';
  lastAssessment: string;
  activeSupplements: number;
  professional: string;
  status: 'active' | 'inactive' | 'alert';
}

const MOCK_PATIENTS: Patient[] = [
  { id: 'P001', internalCode: 'PAC-SEED-001', name: 'M. S.', age: 28, gender: 'F', primaryGoal: 'Hipertrofia', activeAlerts: 2, alertSeverity: 'danger', lastAssessment: '22/05/2026', activeSupplements: 4, professional: 'Dra. Ana Costa', status: 'alert' },
  { id: 'P002', internalCode: 'PAC-002', name: 'J. R.', age: 42, gender: 'M', primaryGoal: 'Emagrecimento', activeAlerts: 1, alertSeverity: 'warning', lastAssessment: '20/05/2026', activeSupplements: 2, professional: 'Dra. Ana Costa', status: 'alert' },
  { id: 'P003', internalCode: 'PAC-003', name: 'C. A.', age: 35, gender: 'F', primaryGoal: 'Saúde geral', activeAlerts: 0, alertSeverity: 'none', lastAssessment: '18/05/2026', activeSupplements: 3, professional: 'Dra. Ana Costa', status: 'active' },
  { id: 'P004', internalCode: 'PAC-004', name: 'L. M.', age: 24, gender: 'M', primaryGoal: 'Performance', activeAlerts: 1, alertSeverity: 'info', lastAssessment: '15/05/2026', activeSupplements: 6, professional: 'Dra. Ana Costa', status: 'active' },
  { id: 'P005', internalCode: 'PAC-005', name: 'F. B.', age: 55, gender: 'F', primaryGoal: 'Melhora metabólica', activeAlerts: 3, alertSeverity: 'critical', lastAssessment: '12/05/2026', activeSupplements: 1, professional: 'Dra. Ana Costa', status: 'alert' },
  { id: 'P006', internalCode: 'PAC-006', name: 'R. T.', age: 31, gender: 'M', primaryGoal: 'Performance', activeAlerts: 0, alertSeverity: 'none', lastAssessment: '10/05/2026', activeSupplements: 5, professional: 'Dra. Ana Costa', status: 'inactive' },
];

const ALERT_STYLE: Record<Patient['alertSeverity'], { dot: string; badge: string; label: string; avatarRing: string }> = {
  none:     { dot: '',                       badge: '',                                  label: '',       avatarRing: '' },
  info:     { dot: 'bg-blue-400',            badge: 'bg-blue-50 text-blue-700 border border-blue-200',    label: 'Info',     avatarRing: 'ring-2 ring-blue-300' },
  warning:  { dot: 'bg-yellow-400',          badge: 'bg-yellow-50 text-yellow-800 border border-yellow-200', label: 'Atenção', avatarRing: 'ring-2 ring-yellow-400' },
  danger:   { dot: 'bg-red-500',             badge: 'bg-red-50 text-red-700 border border-red-200',       label: 'Alto risco', avatarRing: 'ring-2 ring-red-400' },
  critical: { dot: 'bg-red-700 animate-pulse', badge: 'bg-red-100 text-red-900 border border-red-300 font-bold', label: 'Crítico', avatarRing: 'ring-2 ring-red-600' },
};

const STATUS_BADGE: Record<Patient['status'], string> = {
  active:   'bg-green-50 text-green-700 border border-green-200',
  inactive: 'bg-gray-50 text-gray-500 border border-gray-200',
  alert:    'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_LABEL: Record<Patient['status'], string> = {
  active: 'Em acompanhamento',
  inactive: 'Inativo',
  alert: 'Alerta pendente',
};

// Color palette for avatars
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
];

type FilterType = 'all' | 'alert' | 'active' | 'inactive';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = MOCK_PATIENTS.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      (p.internalCode.toLowerCase().includes(term)) ||
      (p.name?.toLowerCase().includes(term) ?? false) ||
      (p.primaryGoal.toLowerCase().includes(term));
    const matchFilter =
      filter === 'all' ||
      (filter === 'alert' && p.activeAlerts > 0) ||
      (filter === 'active' && p.status === 'active') ||
      (filter === 'inactive' && p.status === 'inactive');
    return matchSearch && matchFilter;
  });

  const tabs: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: MOCK_PATIENTS.length },
    { key: 'alert', label: 'Com alertas', count: MOCK_PATIENTS.filter((p) => p.activeAlerts > 0).length },
    { key: 'active', label: 'Em acompanhamento', count: MOCK_PATIENTS.filter((p) => p.status === 'active').length },
    { key: 'inactive', label: 'Inativos', count: MOCK_PATIENTS.filter((p) => p.status === 'inactive').length },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Pacientes"
        description={`${MOCK_PATIENTS.length} pacientes · ${MOCK_PATIENTS.filter((p) => p.activeAlerts > 0).length} com alertas pendentes`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pacientes' }]}
        action={
          <Link href="/patients/new">
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo Paciente
            </Button>
          </Link>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-5 flex-1">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: MOCK_PATIENTS.length, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: 'Críticos', value: MOCK_PATIENTS.filter((p) => p.alertSeverity === 'critical').length, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Alto risco', value: MOCK_PATIENTS.filter((p) => p.alertSeverity === 'danger').length, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Sem alertas', value: MOCK_PATIENTS.filter((p) => p.activeAlerts === 0).length, color: 'text-green-700', bg: 'bg-green-50' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nome ou objetivo..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                  ${filter === tab.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {tab.key === 'alert' && <AlertTriangle className="h-3 w-3" />}
                {tab.label}
                <span className={`text-[10px] px-1 py-0.5 rounded-full ${filter === tab.key ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Patient list */}
        <div className="space-y-2">
          {filtered.map((patient, i) => {
            const alertStyle = ALERT_STYLE[patient.alertSeverity];
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const initials = patient.name
              ? patient.name.split(' ').map((n) => n[0]).join('')
              : patient.internalCode.slice(0, 2);

            return (
              <Link key={patient.id} href={`/patients/${patient.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer group hover:-translate-y-0.5">
                  <CardContent className="py-3.5 px-5">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full ${avatarColor} ${alertStyle.avatarRing} flex items-center justify-center`}>
                          <span className="text-white text-sm font-bold">{initials}</span>
                        </div>
                        {patient.activeAlerts > 0 && (
                          <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${alertStyle.dot}`} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">{patient.internalCode}</span>
                          <span className="text-xs text-gray-400">
                            {patient.age} anos · {patient.gender === 'F' ? 'Feminino' : 'Masculino'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[patient.status]}`}>
                            {STATUS_LABEL[patient.status]}
                          </span>
                          {patient.activeAlerts > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${alertStyle.badge}`}>
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {patient.activeAlerts} {patient.activeAlerts > 1 ? 'alertas' : 'alerta'} · {alertStyle.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Target className="h-3 w-3 text-gray-400" /> {patient.primaryGoal}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Pill className="h-3 w-3 text-gray-400" /> {patient.activeSupplements} suplementos
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-gray-400" /> {patient.lastAssessment}
                          </span>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-300 hidden lg:block">{patient.professional}</span>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhum paciente encontrado</p>
              <p className="text-xs mt-1">Tente ajustar os filtros ou a busca</p>
            </div>
          )}
        </div>

        {/* LGPD notice */}
        <p className="text-[10px] text-gray-400 text-center border-t pt-4 leading-relaxed">
          Apenas pacientes do seu workspace são exibidos. Todos os acessos são registrados conforme LGPD (Lei 13.709/2018).
        </p>
      </div>
    </div>
  );
}
