import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity, ShieldCheck, FlaskConical, FileText, Target, ClipboardList,
  Microscope, Dumbbell, Sparkles, ArrowRight, CheckCircle2, Lock, Brain, LineChart,
  Quote, Star, User, Users, Building2, Mail,
} from 'lucide-react';

// A landing é pública e indexável (o restante do app permanece noindex via layout).
export const metadata: Metadata = {
  title: 'NutriPerformance Clinical — Plataforma para Nutricionistas e Educadores Físicos',
  description:
    'Avaliação nutricional e física, suplementação com apoio de IA, análise de interações, ' +
    'biodisponibilidade, exames laboratoriais, prescrições em PDF e relatórios clínicos. ' +
    'Conforme LGPD, para profissionais CFN e CONFEF.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'NutriPerformance Clinical',
    description:
      'Plataforma de apoio clínico para Nutricionistas e Profissionais de Educação Física.',
    type: 'website',
  },
};

const SALES_EMAIL = 'contato@nutriperformance.com.br';

const features = [
  { icon: Activity, title: 'Avaliação Nutricional', desc: 'TMB (Harris-Benedict), GET, IMC, diagnóstico e estratégia com geração de relatório.' },
  { icon: Dumbbell, title: 'Avaliação Física', desc: 'Composição corporal, percentual de gordura, massa magra, força e tabela de medidas.' },
  { icon: Sparkles, title: 'Protocolo de Suplementação com IA', desc: 'Sugestões de suplementação baseadas em objetivos, com apoio de inteligência artificial.' },
  { icon: FlaskConical, title: 'Análise de Interações', desc: 'Interações entre suplementos com grau de risco: baixo, moderado, alto ou contraindicado.' },
  { icon: Microscope, title: 'Biodisponibilidade', desc: 'Análise de absorção de nutrientes para otimizar a eficácia dos protocolos.' },
  { icon: ClipboardList, title: 'Exames Laboratoriais', desc: 'Registro e interpretação de exames integrados ao histórico do paciente.' },
  { icon: FileText, title: 'Prescrições em PDF', desc: 'Protocolos e prescrições nutricionais com cabeçalho institucional, alertas e assinatura.' },
  { icon: Target, title: 'Metas e Acompanhamento', desc: 'Defina metas clínicas e acompanhe o progresso com indicadores visuais.' },
];

const steps = [
  { n: '1', icon: ClipboardList, title: 'Cadastre o paciente', desc: 'Registre dados clínicos, antropométricos e objetivos em poucos minutos.' },
  { n: '2', icon: Brain, title: 'Avalie e analise', desc: 'Gere avaliações, protocolos com IA e verifique interações e biodisponibilidade.' },
  { n: '3', icon: LineChart, title: 'Prescreva e acompanhe', desc: 'Emita prescrições em PDF, defina metas e acompanhe a evolução ao longo do tempo.' },
];

// ⚠️ DEPOIMENTOS ILUSTRATIVOS — substituir por depoimentos reais e autorizados
// pelos profissionais antes de divulgar (ver nota de conformidade no chat).
const testimonials = [
  { name: 'Dra. Marina Costa', role: 'Nutricionista • CRN-3', text: 'Reduzi pela metade o tempo de montagem de protocolos. A análise de interações me dá muito mais segurança nas condutas.' },
  { name: 'Prof. Rafael Lima', role: 'Educador Físico • CREF', text: 'A avaliação física e o acompanhamento de metas em um só lugar mudaram a forma como apresento resultados aos meus alunos.' },
  { name: 'Dra. Beatriz Andrade', role: 'Nutricionista Clínica', text: 'As prescrições em PDF com identidade da clínica deram um nível de profissionalismo que meus pacientes percebem.' },
];

const plans = [
  {
    icon: User, name: 'Starter', tagline: 'Para começar', highlight: false,
    features: ['1 profissional', 'Cadastro de pacientes', 'Avaliação nutricional e física', 'Relatórios em PDF'],
  },
  {
    icon: Sparkles, name: 'Pro', tagline: 'Profissional autônomo', highlight: true,
    features: ['Tudo do Starter', 'Suplementação com IA', 'Análise de interações e biodisponibilidade', 'Exames laboratoriais', 'Prescrições com identidade própria'],
  },
  {
    icon: Users, name: 'Clínica', tagline: 'Equipes', highlight: false,
    features: ['Múltiplos profissionais', 'Gestão de workspace', 'Trilha de auditoria', 'Suporte prioritário'],
  },
  {
    icon: Building2, name: 'Institucional', tagline: 'Grande escala', highlight: false,
    features: ['Profissionais ilimitados', 'Onboarding dedicado', 'SLA e integrações', 'Gestão centralizada'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
              <span className="text-sm font-bold text-white">NP</span>
            </div>
            <span className="text-base font-bold tracking-tight">NutriPerformance <span className="text-blue-600">Clinical</span></span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
            <a href="#recursos" className="hover:text-blue-600">Recursos</a>
            <a href="#como-funciona" className="hover:text-blue-600">Como funciona</a>
            <a href="#depoimentos" className="hover:text-blue-600">Depoimentos</a>
            <a href="#planos" className="hover:text-blue-600">Planos</a>
            <a href="#seguranca" className="hover:text-blue-600">Segurança</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:inline-flex">
              Entrar
            </Link>
            <Link href="/login?mode=register" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700">
              Criar conta <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center md:py-28">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Para profissionais habilitados — CFN · CONFEF
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-5xl">
            Apoio clínico inteligente para{' '}
            <span className="text-blue-600">nutricionistas e educadores físicos</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
            Avaliações, suplementação com IA, interações, biodisponibilidade, exames,
            prescrições em PDF e relatórios — tudo em uma plataforma única, segura e em conformidade com a LGPD.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=register" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-blue-700 sm:w-auto">
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-7 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto">
              Já tenho conta
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Criptografia AES-256</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Conforme LGPD (Lei 13.709/2018)</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Apoio à decisão clínica</span>
          </div>
        </div>
      </section>

      {/* PREVIEW DO PRODUTO (mockup ilustrativo em CSS) */}
      <section className="mx-auto -mt-10 max-w-5xl px-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* barra da janela */}
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-3 rounded bg-white px-3 py-1 text-xs text-gray-400">nutriperformance-clinical.vercel.app/dashboard</span>
          </div>
          <div className="flex">
            {/* sidebar fake */}
            <aside className="hidden w-48 flex-shrink-0 border-r border-gray-100 bg-gray-50 p-4 sm:block">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-bold text-white">NP</div>
                <span className="text-xs font-semibold text-gray-700">Clinical</span>
              </div>
              {['Dashboard', 'Pacientes', 'Avaliações', 'Suplementação', 'Prescrições', 'Relatórios'].map((it, i) => (
                <div key={it} className={`mb-1 rounded-md px-3 py-2 text-xs ${i === 0 ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-500'}`}>{it}</div>
              ))}
            </aside>
            {/* conteúdo fake */}
            <div className="flex-1 p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { l: 'Pacientes', v: '128', c: 'text-blue-600' },
                  { l: 'Avaliações', v: '342', c: 'text-emerald-600' },
                  { l: 'Alertas', v: '7', c: 'text-amber-600' },
                  { l: 'Tokens', v: '∞', c: 'text-indigo-600' },
                ].map((k) => (
                  <div key={k.l} className="rounded-xl border border-gray-100 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">{k.l}</p>
                    <p className={`text-xl font-bold ${k.c}`}>{k.v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="mb-3 text-xs font-semibold text-gray-600">Evolução de composição corporal</p>
                <div className="flex h-28 items-end gap-2">
                  {[40, 55, 48, 62, 70, 65, 80, 76, 88].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-500 to-indigo-400" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-gray-400">Imagem ilustrativa da interface.</p>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Tudo que sua prática clínica precisa</h2>
          <p className="mt-3 text-gray-600">Módulos integrados que conversam entre si, do cadastro do paciente à prescrição final.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <f.icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Como funciona</h2>
            <p className="mt-3 text-gray-600">Um fluxo simples, do primeiro atendimento ao acompanhamento contínuo.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl bg-white p-7 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{s.n}</div>
                <s.icon className="absolute right-6 top-6 h-6 w-6 text-blue-200" />
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="depoimentos" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Quem usa, recomenda</h2>
          <p className="mt-3 text-gray-600">Profissionais que ganharam tempo e segurança clínica com a plataforma.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <Quote className="h-7 w-7 text-blue-200" />
              <div className="mt-2 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">“{t.text}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-gray-100 pt-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {t.name.split(' ').slice(-1)[0][0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Planos para cada fase</h2>
            <p className="mt-3 text-gray-600">Do profissional autônomo à instituição. Valores sob consulta — fale com nosso time.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.name} className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${p.highlight ? 'border-blue-600 ring-2 ring-blue-600' : 'border-gray-100'}`}>
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white">Mais popular</span>
                )}
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                  <p.icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className="text-xs text-gray-500">{p.tagline}</p>
                <p className="mt-4 text-2xl font-extrabold text-gray-900">Sob consulta</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span className="text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Interesse no plano ' + p.name + ' — NutriPerformance Clinical')}`}
                  className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${p.highlight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Mail className="h-4 w-4" /> Falar com vendas
                </a>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-gray-500">
            Prefere experimentar primeiro?{' '}
            <Link href="/login?mode=register" className="font-semibold text-blue-600 hover:underline">Crie sua conta</Link> e comece agora.
          </p>
        </div>
      </section>

      {/* SEGURANÇA / LGPD */}
      <section id="seguranca" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <Lock className="h-3.5 w-3.5" /> Privacidade e conformidade
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Dados clínicos protegidos por padrão</h2>
            <p className="mt-4 text-gray-600">
              Tratamento de dados sensíveis de saúde em conformidade com a LGPD (Lei 13.709/2018),
              com consentimento registrado, central de direitos do titular e criptografia em repouso e em trânsito.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Criptografia AES-256 e conexões seguras (HTTPS/HSTS)',
                'Consentimento LGPD registrado no cadastro',
                'Central de Direitos do Titular (Art. 18)',
                'Política de Privacidade, Termos e Cookies completos',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
            <ShieldCheck className="h-10 w-10 text-blue-600" />
            <p className="mt-4 text-lg font-semibold text-gray-900">Ferramenta de apoio profissional</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              A NutriPerformance Clinical apoia a decisão de profissionais habilitados e
              <strong> não substitui a avaliação clínica individual</strong>. O profissional permanece
              responsável pelas condutas adotadas.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['CFN', 'CONFEF', 'LGPD', 'AES-256'].map((b) => (
                <span key={b} className="rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700">{b}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-blue-600">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Pronto para elevar sua prática clínica?</h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-100">
            Crie sua conta profissional e comece a usar avaliações, suplementação com IA e prescrições em PDF hoje mesmo.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login?mode=register" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-7 py-3 text-base font-semibold text-blue-700 shadow-lg transition-colors hover:bg-blue-50 sm:w-auto">
              Criar conta <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="inline-flex w-full items-center justify-center rounded-lg border border-blue-400 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-500 sm:w-auto">
              Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
                  <span className="text-sm font-bold text-white">NP</span>
                </div>
                <span className="text-base font-bold">NutriPerformance Clinical</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">
                Plataforma de apoio clínico para nutricionistas e profissionais de educação física.
                Ferramenta de apoio — não substitui avaliação clínica.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              <div className="flex flex-col gap-2">
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Plataforma</span>
                <Link href="/login" className="text-gray-600 hover:text-blue-600">Entrar</Link>
                <Link href="/login?mode=register" className="text-gray-600 hover:text-blue-600">Criar conta</Link>
                <a href="#recursos" className="text-gray-600 hover:text-blue-600">Recursos</a>
                <a href="#planos" className="text-gray-600 hover:text-blue-600">Planos</a>
              </div>
              <div className="flex flex-col gap-2">
                <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Legal</span>
                <Link href="/legal/privacy" className="text-gray-600 hover:text-blue-600">Privacidade</Link>
                <Link href="/legal/terms" className="text-gray-600 hover:text-blue-600">Termos de Uso</Link>
                <Link href="/legal/cookies" className="text-gray-600 hover:text-blue-600">Cookies</Link>
                <Link href="/legal/dados" className="text-gray-600 hover:text-blue-600">Direitos do Titular</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-6 text-xs text-gray-400 sm:flex-row">
            <span>© 2026 NutriPerformance Clinical. Todos os direitos reservados.</span>
            <span>Encarregado de Dados (DPO): dpo@nutriperformance.com.br</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
