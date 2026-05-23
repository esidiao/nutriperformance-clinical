'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, ShieldAlert, UserPlus } from 'lucide-react';

const DIETARY_RESTRICTIONS = [
  'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose',
  'Sem frutos do mar', 'Halal', 'Kosher', 'Sem amendoim',
];

export default function PatientNewPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const [form, setForm] = useState({
    name: '',
    cpf: '',
    birthDate: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    mainObjective: '',
    medicalHistory: '',
    currentMedications: '',
    allergies: '',
    dietaryRestrictions: [] as string[],
  });

  const set = (field: string, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const toggleRestriction = (r: string) => {
    setForm((p) => ({
      ...p,
      dietaryRestrictions: p.dietaryRestrictions.includes(r)
        ? p.dietaryRestrictions.filter((x) => x !== r)
        : [...p.dietaryRestrictions, r],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgpdConsent) {
      setError('O consentimento LGPD é obrigatório para cadastrar o paciente.');
      return;
    }
    if (!form.name || !form.birthDate || !form.gender) {
      setError('Nome, data de nascimento e sexo biológico são obrigatórios.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      // In production: await api.patients.create({ ...form, lgpdConsent: true })
      await new Promise((r) => setTimeout(r, 1200));
      router.push('/patients');
    } catch (err: any) {
      setError(err.message ?? 'Erro ao cadastrar paciente');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-blue-600" />
          Novo Paciente
        </h1>
        <p className="text-gray-500 text-sm mt-1">Preencha os dados e colete o consentimento LGPD</p>
      </div>

      {error && (
        <Alert className="border-red-300 bg-red-50">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Dados pessoais */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nome completo *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Nome completo do paciente" required />
            </div>
            <div>
              <Label>CPF (opcional — armazenado de forma irreversível)</Label>
              <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)}
                placeholder="000.000.000-00" />
              <p className="text-xs text-gray-400 mt-1">O CPF é convertido em hash SHA-256 e nunca armazenado em texto</p>
            </div>
            <div>
              <Label>Data de nascimento *</Label>
              <Input type="date" value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)} required />
            </div>
            <div>
              <Label>Sexo biológico *</Label>
              <select
                value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
                className="w-full h-10 rounded-md border px-3 text-sm"
                required
              >
                <option value="">Selecionar</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="other">Outro / Não informado</option>
              </select>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email}
                onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone}
                onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-0000" />
            </div>
            <div className="md:col-span-2">
              <Label>Endereço</Label>
              <Input value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Rua, número, bairro, cidade - UF" />
            </div>
          </CardContent>
        </Card>

        {/* Contato de emergência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contato de Emergência</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.emergencyContactName}
                onChange={(e) => set('emergencyContactName', e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.emergencyContactPhone}
                onChange={(e) => set('emergencyContactPhone', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Objetivo e histórico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Objetivo e Histórico Clínico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Objetivo principal</Label>
              <select
                value={form.mainObjective}
                onChange={(e) => set('mainObjective', e.target.value)}
                className="w-full h-10 rounded-md border px-3 text-sm"
              >
                <option value="">Selecionar</option>
                <option value="weight_loss">Emagrecimento</option>
                <option value="hypertrophy">Hipertrofia</option>
                <option value="body_recomposition">Recomposição corporal</option>
                <option value="metabolic_improvement">Melhora metabólica</option>
                <option value="performance_improvement">Melhora de performance</option>
                <option value="endurance_gain">Ganho de resistência</option>
                <option value="general_health">Saúde geral</option>
                <option value="clinical_recovery">Recuperação clínica</option>
              </select>
            </div>
            <div>
              <Label>Histórico médico relevante</Label>
              <Textarea value={form.medicalHistory}
                onChange={(e) => set('medicalHistory', e.target.value)}
                placeholder="Doenças pré-existentes, cirurgias, hospitalizações..."
                rows={3} />
            </div>
            <div>
              <Label>Medicamentos em uso</Label>
              <Textarea value={form.currentMedications}
                onChange={(e) => set('currentMedications', e.target.value)}
                placeholder="Nome, dose e frequência de cada medicamento..."
                rows={2} />
            </div>
            <div>
              <Label>Alergias e intolerâncias</Label>
              <Input value={form.allergies}
                onChange={(e) => set('allergies', e.target.value)}
                placeholder="Ex: amendoim, lactose, frutos do mar" />
            </div>
            <div>
              <Label>Restrições alimentares</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIETARY_RESTRICTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRestriction(r)}
                    className={`px-3 py-1 rounded-full text-xs border transition-all ${
                      form.dietaryRestrictions.includes(r)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consentimento LGPD */}
        <Card className="border-green-200 bg-green-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Consentimento LGPD (Obrigatório)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-white">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 text-xs leading-relaxed">
                De acordo com a <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)</strong>,
                os dados pessoais e dados sensíveis de saúde do paciente serão tratados exclusivamente
                para fins de acompanhamento nutricional e de saúde. Os dados serão armazenados com
                criptografia AES-256, acessados apenas pelos profissionais autorizados deste workspace
                e nunca compartilhados com terceiros sem consentimento explícito. O paciente tem
                direito de solicitar acesso, correção e exclusão de seus dados a qualquer momento
                (LGPD Art. 18). O profissional é responsável por obter este consentimento de forma
                livre, informada e inequívoca.
              </AlertDescription>
            </Alert>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lgpdConsent}
                onChange={(e) => setLgpdConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-800 leading-relaxed">
                Confirmo que o paciente foi informado sobre o tratamento de seus dados pessoais e
                de saúde conforme a LGPD, e que forneceu consentimento livre, informado e
                inequívoco para o tratamento descrito acima. Declaro ter ciência de que esta
                operação será registrada em log de auditoria com data e hora.
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !lgpdConsent}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <><span className="animate-spin">⟳</span> Cadastrando…</>
            ) : (
              <><UserPlus className="h-4 w-4" /> Cadastrar Paciente</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
