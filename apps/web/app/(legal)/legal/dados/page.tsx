'use client';

import { useState } from 'react';
import { Shield, Download, Trash2, Eye, Edit3, RotateCcw, Mail, CheckCircle, AlertTriangle } from 'lucide-react';

const RIGHTS = [
  {
    id: 'access',
    icon: Eye,
    title: 'Acesso aos dados',
    desc: 'Solicitar confirmação de que tratamos seus dados e obter cópia completa.',
    article: 'Art. 18, I e II',
    color: 'blue',
  },
  {
    id: 'export',
    icon: Download,
    title: 'Portabilidade / Exportar',
    desc: 'Receber seus dados pessoais em formato estruturado (JSON) para uso em outra plataforma.',
    article: 'Art. 18, V',
    color: 'green',
  },
  {
    id: 'rectify',
    icon: Edit3,
    title: 'Retificação',
    desc: 'Corrigir dados pessoais incompletos, inexatos ou desatualizados.',
    article: 'Art. 18, III',
    color: 'yellow',
  },
  {
    id: 'delete',
    icon: Trash2,
    title: 'Exclusão',
    desc: 'Solicitar a eliminação dos seus dados pessoais tratados com base em consentimento.',
    article: 'Art. 18, VI',
    color: 'red',
  },
  {
    id: 'revoke',
    icon: RotateCcw,
    title: 'Revogar consentimento',
    desc: 'Retirar consentimento a qualquer momento, sem prejuízo da legalidade dos tratamentos anteriores.',
    article: 'Art. 18, IX',
    color: 'orange',
  },
  {
    id: 'oppose',
    icon: Shield,
    title: 'Oposição',
    desc: 'Opor-se a tratamento realizado com base em legítimo interesse quando houver descumprimento da LGPD.',
    article: 'Art. 18, VII',
    color: 'purple',
  },
];

const COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-50 border-blue-200 text-blue-700',
  green:  'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red:    'bg-red-50 border-red-200 text-red-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
};

export default function DadosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [details, setDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const right = RIGHTS.find((r) => r.id === selected);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-3 uppercase tracking-wide">
          <Shield className="h-4 w-4" /> Seus Direitos — LGPD Art. 18
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Central de Direitos dos Titulares</h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          Conforme a LGPD (Lei 13.709/2018), você tem direitos sobre seus dados pessoais.
          Selecione abaixo o direito que deseja exercer — respondemos em até <strong>15 dias úteis</strong>.
        </p>
      </div>

      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-green-900 mb-2">Solicitação enviada!</h2>
          <p className="text-sm text-green-700 mb-4">
            Recebemos sua solicitação de <strong>{right?.title}</strong>.
            Responderemos no e-mail cadastrado em até 15 dias úteis.
          </p>
          <p className="text-xs text-green-600">
            Protocolo gerado em: {new Date().toLocaleString('pt-BR')}
          </p>
          <button
            onClick={() => { setSubmitted(false); setSelected(null); setDetails(''); }}
            className="mt-4 text-xs text-green-700 hover:underline"
          >
            ← Fazer outra solicitação
          </button>
        </div>
      ) : (
        <>
          {/* Rights grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {RIGHTS.map((r) => {
              const Icon = r.icon;
              const isSelected = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(isSelected ? null : r.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `${COLOR_MAP[r.color]} border-current shadow-sm`
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isSelected ? '' : 'text-gray-400'}`} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{r.desc}</p>
                      <span className="text-[10px] mt-1.5 inline-block bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        LGPD {r.article}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form */}
          {selected && (
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                {right && <right.icon className="h-4 w-4 text-gray-500" />}
                Solicitação: {right?.title}
              </h2>

              {selected === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    <strong>Atenção:</strong> A exclusão é irreversível após 30 dias de quarentena.
                    Os dados de pacientes vinculados à sua conta também serão removidos.
                    Faça o backup antes de prosseguir.
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Detalhes adicionais (opcional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  placeholder="Descreva sua solicitação com mais detalhes se necessário..."
                  className="w-full rounded-lg border border-gray-200 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Mail className="h-4 w-4" /> Enviar solicitação
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-xs text-gray-400">
                A solicitação será enviada para <strong>dpo@nutriperformance.com.br</strong> com seus dados de identificação.
                Prazo de resposta: até 15 dias úteis (LGPD Art. 19).
              </p>
            </form>
          )}

          {/* Alternative contact */}
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600">
            <p className="font-medium text-gray-800 mb-1">Prefere contato direto?</p>
            <p>
              Envie um e-mail para{' '}
              <a href="mailto:dpo@nutriperformance.com.br" className="text-blue-600 hover:underline font-medium">
                dpo@nutriperformance.com.br
              </a>{' '}
              com o assunto <strong>"LGPD — [Direito solicitado]"</strong> e seu nome completo e e-mail cadastrado.
            </p>
            <p className="mt-2">
              Você também pode contatar a <strong>ANPD</strong>:{' '}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                gov.br/anpd
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
