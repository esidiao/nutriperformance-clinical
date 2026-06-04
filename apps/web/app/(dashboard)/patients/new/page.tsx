'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/PageHeader';
import { CheckCircle, ShieldCheck, ShieldAlert, UserPlus, ChevronRight, ChevronLeft, User, Heart, Target, Activity, TrendingUp } from 'lucide-react';

// ─── Wizard step config ───────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Dados Pessoais',     icon: User,        description: 'Informações de identificação' },
  { id: 2, label: 'Saúde & Histórico',  icon: Heart,       description: 'Histórico clínico e medicamentos' },
  { id: 3, label: 'Avaliação Física',   icon: Activity,    description: 'Medidas iniciais (opcional)' },
  { id: 4, label: 'Objetivos & LGPD',   icon: Target,      description: 'Metas e consentimento' },
];

const TOTAL_STEPS = STEPS.length;

const DIETARY_RESTRICTIONS = [
  'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose',
  'Sem frutos do mar', 'Halal', 'Kosher', 'Sem amendoim',
];

const GOALS = [
  { value: 'weight_loss',              label: 'Emagrecimento' },
  { value: 'hypertrophy',              label: 'Hipertrofia' },
  { value: 'body_recomposition',       label: 'Recomposição corporal' },
  { value: 'metabolic_improvement',    label: 'Melhora metabólica' },
  { value: 'performance_improvement',  label: 'Melhora de performance' },
  { value: 'endurance_gain',           label: 'Ganho de resistência' },
  { value: 'general_health',           label: 'Saúde geral' },
  { value: 'clinical_recovery',        label: 'Recuperação clínica' },
];

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${done    ? 'bg-green-500 text-white' :
                  active  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-400'}
              `}>
                {done ? <CheckCircle className="h-4 w-4" /> : step.id}
              </div>
              <div className="hidden sm:block">
                <p className={`text-xs font-semibold leading-tight ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-gray-400 leading-tight">{step.description}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PatientNewPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    // Step 1
    name: '', cpf: '', birthDate: '', gender: '',
    email: '', phone: '', address: '',
    emergencyContactName: '', emergencyContactPhone: '',
    // Step 2
    medicalHistory: '', currentMedications: '',
    allergies: '', dietaryRestrictions: [] as string[],
    // Step 3 — Avaliação física inicial (opcional)
    weightKg: '', heightCm: '', bodyFatPct: '', waistCm: '', hipCm: '', assessmentMethod: '',
    // Step 4
    mainObjective: '', professionalNotes: '',
    lgpdConsent: false,
  });

  // IMC calculado da avaliação física inicial
  const newBmi = (() => {
    const w = parseFloat(String(form.weightKg).replace(',', '.'));
    const h = parseFloat(String(form.heightCm).replace(',', '.'));
    return w > 0 && h > 0 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  })();
  const bmiLabel = newBmi == null ? '' :
    newBmi < 18.5 ? 'Abaixo do peso' : newBmi < 25 ? 'Normal' : newBmi < 30 ? 'Sobrepeso' : 'Obesidade';

  const set = (field: string, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }));

  const toggleRestriction = (r: string) =>
    setForm((p) => ({
      ...p,
      dietaryRestrictions: p.dietaryRestrictions.includes(r)
        ? p.dietaryRestrictions.filter((x) => x !== r)
        : [...p.dietaryRestrictions, r],
    }));

  // Validate before advancing step
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!form.name.trim())      newErrors.name = 'Nome é obrigatório';
      if (!form.birthDate)        newErrors.birthDate = 'Data de nascimento é obrigatória';
      if (!form.gender)           newErrors.gender = 'Sexo biológico é obrigatório';
    }
    if (step === 4) {
      if (!form.mainObjective)    newErrors.mainObjective = 'Selecione o objetivo principal';
      if (!form.lgpdConsent)      newErrors.lgpdConsent = 'O consentimento LGPD é obrigatório';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSaving(true);
    const t = toast.loading('Cadastrando paciente...');
    try {
      const dto: Record<string, unknown> = {
        name: form.name.trim(),
        birthDate: form.birthDate, // YYYY-MM-DD (aceito como IsDateString)
        gender: (['male', 'female', 'other'].includes(form.gender) ? form.gender : 'not_informed'),
        lgpdConsent: form.lgpdConsent,
      };
      if (form.email.trim()) dto.email = form.email.trim();
      if (form.phone.trim()) dto.phone = form.phone.trim();
      if (form.cpf.trim()) dto.cpf = form.cpf.trim();

      const created: any = await api.patients.create(dto);

      // Avaliação física inicial (opcional): grava se peso e altura informados.
      if (created?.id && form.weightKg && form.heightCm) {
        try {
          await api.assessments.createPhysical({
            patientId: created.id,
            weightKg: Number(form.weightKg),
            heightCm: Number(form.heightCm),
            bodyFatPct: form.bodyFatPct ? Number(form.bodyFatPct) : undefined,
            waistCm: form.waistCm ? Number(form.waistCm) : undefined,
            hipCm: form.hipCm ? Number(form.hipCm) : undefined,
            assessmentMethod: form.assessmentMethod || undefined,
          });
        } catch {
          // Não bloquear o cadastro do paciente se a avaliação inicial falhar
          toast.message('Paciente cadastrado; a avaliação física inicial não pôde ser salva agora.');
        }
      }

      toast.success(`Paciente ${form.name.split(' ')[0]} cadastrado com sucesso!`, { id: t });
      router.push('/patients');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao cadastrar paciente.', { id: t });
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        title="Novo Paciente"
        description="Preencha os dados em 3 etapas simples"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Pacientes', href: '/patients' },
          { label: 'Novo Paciente' },
        ]}
      />

      <div className="px-4 py-5 sm:p-6 max-w-2xl mx-auto w-full flex-1">
        <StepIndicator current={step} />

        {/* ── STEP 1: Dados Pessoais ── */}
        {step === 1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" /> Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Nome completo do paciente"
                  className={errors.name ? 'border-red-400' : ''}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>CPF <span className="text-gray-400 text-xs">(hash SHA-256 — nunca armazenado)</span></Label>
                <Input value={form.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>Data de nascimento *</Label>
                <Input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set('birthDate', e.target.value)}
                  className={errors.birthDate ? 'border-red-400' : ''}
                />
                {errors.birthDate && <p className="text-xs text-red-500 mt-1">{errors.birthDate}</p>}
              </div>
              <div>
                <Label>Sexo biológico *</Label>
                <select
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  className={`w-full h-10 rounded-md border px-3 text-sm bg-white dark:bg-gray-900 ${errors.gender ? 'border-red-400' : ''}`}
                >
                  <option value="">Selecionar</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                  <option value="other">Outro / Não informado</option>
                </select>
                {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-0000" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua, número, bairro, cidade — UF" />
              </div>
              <div>
                <Label>Contato de emergência</Label>
                <Input value={form.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} placeholder="Nome" />
              </div>
              <div>
                <Label>Telefone de emergência</Label>
                <Input value={form.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} placeholder="(11) 99999-0000" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: Saúde & Histórico ── */}
        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" /> Saúde & Histórico Clínico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Histórico médico relevante</Label>
                <Textarea
                  value={form.medicalHistory}
                  onChange={(e) => set('medicalHistory', e.target.value)}
                  placeholder="Doenças pré-existentes, cirurgias, hospitalizações, comorbidades..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Medicamentos em uso</Label>
                <Textarea
                  value={form.currentMedications}
                  onChange={(e) => set('currentMedications', e.target.value)}
                  placeholder="Nome do medicamento, dose e frequência..."
                  rows={2}
                />
              </div>
              <div>
                <Label>Alergias e intolerâncias alimentares</Label>
                <Input
                  value={form.allergies}
                  onChange={(e) => set('allergies', e.target.value)}
                  placeholder="Ex: amendoim, frutos do mar, lactose"
                />
              </div>
              <div>
                <Label>Restrições alimentares</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DIETARY_RESTRICTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRestriction(r)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${form.dietaryRestrictions.includes(r)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 hover:border-blue-400'
                        }
                      `}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Avaliação Física inicial (opcional) ── */}
        {step === 3 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" /> Avaliação Física Inicial
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Opcional — registre as medidas iniciais já no cadastro. O IMC é calculado automaticamente.
                Avaliações completas podem ser feitas depois no perfil do paciente.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label>Peso (kg)</Label>
                  <Input type="number" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="70.0" />
                </div>
                <div>
                  <Label>Altura (cm)</Label>
                  <Input type="number" step="0.1" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="170" />
                </div>
                <div>
                  <Label>% Gordura corporal</Label>
                  <Input type="number" step="0.1" value={form.bodyFatPct} onChange={(e) => set('bodyFatPct', e.target.value)} placeholder="22.0" />
                </div>
                <div>
                  <Label>Cintura (cm)</Label>
                  <Input type="number" step="0.1" value={form.waistCm} onChange={(e) => set('waistCm', e.target.value)} placeholder="78" />
                </div>
                <div>
                  <Label>Quadril (cm)</Label>
                  <Input type="number" step="0.1" value={form.hipCm} onChange={(e) => set('hipCm', e.target.value)} placeholder="98" />
                </div>
                <div>
                  <Label>Método</Label>
                  <select value={form.assessmentMethod} onChange={(e) => set('assessmentMethod', e.target.value)}
                    className="w-full h-10 rounded-md border px-3 text-sm bg-white dark:bg-gray-900">
                    <option value="">Selecione</option>
                    <option value="bioimpedancia">Bioimpedância</option>
                    <option value="dobras_cutaneas">Dobras cutâneas</option>
                    <option value="dexa">DEXA</option>
                    <option value="perimetros">Perímetros</option>
                  </select>
                </div>
              </div>
              {newBmi && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">IMC inicial:</span>
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{newBmi}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border dark:border-gray-700">{bmiLabel}</span>
                </div>
              )}
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                  Avaliação física completa é atribuição do Profissional de Educação Física (CONFEF/CREF).
                  Estas medidas iniciais são um registro de apoio.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Objetivos & LGPD ── */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-green-600" /> Objetivo Principal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => { set('mainObjective', g.value); setErrors((e) => ({ ...e, mainObjective: '' })); }}
                      className={`
                        p-3 rounded-xl border-2 text-left text-sm font-medium transition-all
                        ${form.mainObjective === g.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                {errors.mainObjective && <p className="text-xs text-red-500">{errors.mainObjective}</p>}
                <div>
                  <Label>Observações iniciais (opcional)</Label>
                  <Textarea
                    value={form.professionalNotes}
                    onChange={(e) => set('professionalNotes', e.target.value)}
                    placeholder="Observações clínicas relevantes para o início do acompanhamento..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" /> Consentimento LGPD *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert className="border-green-200 bg-white dark:bg-gray-900">
                  <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <AlertDescription className="text-xs text-green-900 dark:text-green-300 leading-relaxed">
                    Conforme a <strong>LGPD (Lei 13.709/2018)</strong>, os dados de saúde do paciente
                    serão tratados com criptografia AES-256, acessados apenas por profissionais autorizados
                    deste workspace e nunca compartilhados sem consentimento. O paciente tem direito de
                    acesso, correção e exclusão (Art. 18).
                  </AlertDescription>
                </Alert>
                <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border-2 transition-all ${form.lgpdConsent ? 'border-green-400 bg-green-50 dark:bg-green-950' : 'border-gray-200 dark:border-gray-700'} ${errors.lgpdConsent ? 'border-red-400' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.lgpdConsent}
                    onChange={(e) => { set('lgpdConsent', e.target.checked); setErrors((er) => ({ ...er, lgpdConsent: '' })); }}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    Confirmo que o paciente foi informado e forneceu consentimento livre e inequívoco
                    para o tratamento de seus dados de saúde conforme a LGPD. Esta operação será
                    registrada em log de auditoria.
                  </span>
                </label>
                {errors.lgpdConsent && <p className="text-xs text-red-500">{errors.lgpdConsent}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={step === 1 ? () => router.back() : handleBack}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Etapa {step} de {TOTAL_STEPS}</span>
            {step < TOTAL_STEPS ? (
              <Button onClick={handleNext} className="flex items-center gap-2">
                Próxima etapa <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar Paciente
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
