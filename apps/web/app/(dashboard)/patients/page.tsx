'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Search, AlertTriangle, ChevronRight,
  User, Calendar, Target, Pill,
} from 'lucide-react';

interface Patient {
  id: string;
  internalCode: string;
  age: number;
  gender: string;
  primaryGoal: string;
  activeAlerts: number;
  alertSeverity: 'none' | 'info' | 'warning' | 'danger' | 'critical';
  lastAssessment: string;
  activeSupplements: number;
  professional: string;
}

const MOCK_PATIENTS: Patient[] = [
  { id: 'P001', internalCode: 'PAC-SEED-001', age: 28, gender: 'F', primaryGoal: 'Hipertrofia', activeAlerts: 2, alertSeverity: 'danger', lastAssessment: '22/05/2026', activeSupplements: 4, professional: 'Dra. Ana Costa' },
  { id: 'P002', internalCode: 'PAC-002', age: 42, gender: 'M', primaryGoal: 'Emagrecimento', activeAlerts: 1, alertSeverity: 'warning', lastAssessment: '20/05/2026', activeSupplements: 2, professional: 'Dra. Ana Costa' },
  { id: 'P003', internalCode: 'PAC-003', age: 35, gender: 'F', primaryGoal: 'Saúde geral', activeAlerts: 0, alertSeverity: 'none', lastAssessment: '18/05/2026', activeSupplements: 3, professional: 'Dra. Ana Costa' },
  { id: 'P004', internalCode: 'PAC-004', age: 24, gender: 'M', primaryGoal: 'Performance', activeAlerts: 1, alertSeverity: 'info', lastAssessment: '15/05/2026', activeSupplements: 6, professional: 'Dra. Ana Costa' },
  { id: 'P005', internalCode: 'PAC-005', age: 55, gender: 'F', primaryGoal: 'Melhora metabólica', activeAlerts: 3, alertSeverity: 'critical', lastAssessment: '12/05/2026', activeSupplements: 1, professional: 'Dra. Ana Costa' },
];

const ALERT_STYLE: Record<Patient['alertSeverity'], { dot: string; badge: string; label: string }> = {
  none:     { dot: 'bg-gray-200',  badge: '', label: '' },
  info:     { dot: 'bg-blue-400',  badge: 'bg-blue-100 text-blue-700', label: 'Info' },
  warning:  { dot: 'bg-yellow-400',badge: 'bg-yellow-100 text-yellow-800', label: 'Atenção' },
  danger:   { dot: 'bg-red-500',   badge: 'bg-red-100 text-red-700', label: 'Alto risco' },
  critical: { dot: 'bg-red-700 animate-pulse', badge: 'bg-red-200 text-red-900 font-bold', label: 'Crítico' },
};

const GOAL_LABEL: Record<string, string> = {
  'Hipertrofia': 'Hipertrofia',
  'Emagrecimento': 'Emagrecimento',
  'Saúde geral': 'Saúde geral',
  'Performance': 'Performance',
  'Melhora metabólica': 'Metabólico',
};

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filterAlert, setFilterAlert] = useState<'all' | 'alerts'>('all');

  const filtered = MOCK_PATIENTS.filter((p) => {
    const matchSearch = p.internalCode.toLowerCase().includes(search.toLowerCase());
    const matchAlert = filterAlert === 'all' || p.activeAlerts > 0;
    return matchSearch && matchAlert;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            {MOCK_PATIENTS.length} pacientes ativos · {MOCK_PATIENTS.filter((p) => p.activeAlerts > 0).length} com alertas
          </p>
        </div>
        <Link href="/patients/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Paciente
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filterAlert === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterAlert('all')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filterAlert === 'alerts' ? 'default' : 'outline'}
            onClick={() => setFilterAlert('alerts')}
            className="flex items-center gap-1"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Com alertas
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total ativo', value: MOCK_PATIENTS.length, color: 'text-gray-700' },
          { label: 'Alertas críticos', value: MOCK_PATIENTS.filter((p) => p.alertSeverity === 'critical').length, color: 'text-red-700' },
          { label: 'Alto risco', value: MOCK_PATIENTS.filter((p) => p.alertSeverity === 'danger').length, color: 'text-orange-700' },
          { label: 'Sem alertas', value: MOCK_PATIENTS.filter((p) => p.activeAlerts === 0).length, color: 'text-green-700' },
        ].map((s) => (
          <Card key={s.label} className="py-3">
            <CardContent className="pt-0 pb-0 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista de pacientes */}
      <div className="space-y-2">
        {filtered.map((patient) => {
          const alertStyle = ALERT_STYLE[patient.alertSeverity];
          return (
            <Link key={patient.id} href={`/patients/${patient.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      {patient.activeAlerts > 0 && (
                        <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${alertStyle.dot}`} />
                      )}
                    </div>

                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{patient.internalCode}</span>
                        <span className="text-xs text-gray-500">
                          {patient.age} anos · {patient.gender === 'F' ? 'Feminino' : 'Masculino'}
                        </span>
                        {patient.activeAlerts > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${alertStyle.badge} flex items-center gap-1`}>
                            <AlertTriangle className="h-3 w-3" />
                            {patient.activeAlerts} alerta{patient.activeAlerts > 1 ? 's' : ''} · {alertStyle.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Target className="h-3 w-3" /> {patient.primaryGoal}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> {patient.activeSupplements} suplementos
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Última avaliação: {patient.lastAssessment}
                        </span>
                      </div>
                    </div>

                    {/* Profissional e seta */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 hidden md:block">{patient.professional}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum paciente encontrado.</p>
          </div>
        )}
      </div>

      {/* Aviso LGPD */}
      <p className="text-xs text-gray-400 text-center border-t pt-4 leading-relaxed">
        Dados exibidos conforme permissões do seu perfil. Apenas pacientes vinculados ao seu registro são visíveis.
        Todos os acessos são registrados conforme LGPD (Lei 13.709/2018).
      </p>
    </div>
  );
}
