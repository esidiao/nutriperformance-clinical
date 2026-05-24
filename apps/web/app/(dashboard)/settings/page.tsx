'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, User, Building, Bell, Shield, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    fullName: 'Dra. Ana Costa',
    email: 'dra.ana@nutritest.com',
    councilType: 'CFN',
    councilNumber: 'CRN-3 12345',
    councilState: 'SP',
    phone: '(11) 99999-0000',
    specialty: 'Nutrição Clínica e Esportiva',
  });

  const handleSave = async () => {
    toast.promise(new Promise((r) => setTimeout(r, 800)), {
      loading: 'Salvando configurações...',
      success: 'Configurações salvas com sucesso!',
      error: 'Erro ao salvar configurações',
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Configurações"
        description="Perfil profissional, workspace e privacidade"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Configurações' }]}
      />
    <div className="p-6 max-w-3xl mx-auto space-y-6 flex-1">

      {/* Perfil do profissional */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Perfil Profissional
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <Label>Conselho profissional</Label>
            <div className="flex gap-2">
              <select
                value={profile.councilType}
                onChange={(e) => setProfile((p) => ({ ...p, councilType: e.target.value }))}
                className="w-24 h-10 rounded-md border px-2 text-sm">
                <option>CFN</option>
                <option>CONFEF</option>
                <option>CRM</option>
                <option>CRF</option>
              </select>
              <Input value={profile.councilNumber}
                onChange={(e) => setProfile((p) => ({ ...p, councilNumber: e.target.value }))}
                placeholder="CRN-3 12345" />
              <select
                value={profile.councilState}
                onChange={(e) => setProfile((p) => ({ ...p, councilState: e.target.value }))}
                className="w-16 h-10 rounded-md border px-2 text-sm">
                {['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
                  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
                  .map((uf) => <option key={uf}>{uf}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Especialidade / Área de atuação</Label>
            <Input value={profile.specialty}
              onChange={(e) => setProfile((p) => ({ ...p, specialty: e.target.value }))}
              placeholder="Ex: Nutrição Clínica e Esportiva" />
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4 text-blue-600" />
            Workspace / Clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nome da clínica / consultório</Label>
            <Input defaultValue="Clínica NutriTest Demo" />
          </div>
          <div>
            <Label>CNPJ (opcional)</Label>
            <Input placeholder="00.000.000/0000-00" />
          </div>
          <div className="md:col-span-2">
            <Label>Plano atual</Label>
            <div className="flex items-center gap-3 mt-1 p-3 bg-blue-50 rounded-md border border-blue-200">
              <Badge className="bg-blue-600 text-white">Profissional</Badge>
              <span className="text-sm text-gray-700">600 tokens/mês · R$ 129,90/mês</span>
              <button className="ml-auto text-xs text-blue-600 hover:underline">Gerenciar plano</button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { id: 'alerts_critical', label: 'Alertas clínicos críticos', defaultChecked: true },
            { id: 'alerts_high', label: 'Alertas de alto risco', defaultChecked: true },
            { id: 'token_low', label: 'Aviso de saldo baixo de tokens (< 50)', defaultChecked: true },
            { id: 'scientific_stale', label: 'Base científica desatualizada (> 90 dias)', defaultChecked: true },
            { id: 'report_ready', label: 'Relatório gerado com sucesso', defaultChecked: false },
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" defaultChecked={item.defaultChecked}
                className="h-4 w-4 rounded" />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Privacidade e LGPD */}
      <Card className="border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            Privacidade e LGPD
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 bg-green-50">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 text-xs leading-relaxed">
              Seus dados e os dados dos pacientes são protegidos por criptografia AES-256.
              O NutriPerformance Clinical está em conformidade com a LGPD (Lei 13.709/2018).
              Todos os acessos a dados de pacientes são registrados em logs de auditoria.
            </AlertDescription>
          </Alert>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Política de Privacidade', href: '#' },
              { label: 'Termos de Uso', href: '#' },
              { label: 'Exportar meus dados (LGPD Art. 18)', href: '#' },
              { label: 'Logs de auditoria da minha conta', href: '#' },
              { label: 'Contatar o DPO', href: 'mailto:dpo@nutriperformance.com.br' },
            ].map((item) => (
              <a key={item.label} href={item.href}
                className="flex items-center gap-2 text-blue-600 hover:underline">
                → {item.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg">Salvar configurações</Button>
      </div>
    </div>
    </div>
  );
}
