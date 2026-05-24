import { Calendar, AlertTriangle } from 'lucide-react';

export const metadata = { title: 'Termos de Uso — NutriPerformance Clinical' };

export default function TermsPage() {
  return (
    <article className="prose prose-sm max-w-none">
      <div className="not-prose mb-8">
        <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-3 uppercase tracking-wide">
          📄 Documento Legal
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Termos de Uso</h1>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Versão 1.0 — 24/05/2026</span>
        </div>
      </div>

      <div className="not-prose bg-amber-50 border border-amber-300 rounded-xl p-4 mb-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900 mb-1">
              FERRAMENTA DE APOIO CLÍNICO — NÃO SUBSTITUI O PROFISSIONAL
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              O NutriPerformance Clinical é uma ferramenta de apoio à prática profissional.
              <strong> Não constitui diagnóstico, prescrição ou substituição de consulta clínica.</strong>{' '}
              O profissional de saúde habilitado (CFN/CONFEF) é integralmente responsável por todas as
              decisões clínicas tomadas com base nos dados apresentados pela plataforma.
              Resolução CFN 599/2018 e CONFEF aplicáveis.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            1. Aceitação dos Termos
          </h2>
          <p>
            Ao criar uma conta e utilizar o NutriPerformance Clinical ("Plataforma"), você declara:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
            <li>Ser profissional de saúde habilitado pelo CFN (Nutricionista) ou CONFEF (Educador Físico), ou estudante supervisionado</li>
            <li>Ter lido, compreendido e aceito integralmente estes Termos e a <a href="/legal/privacy" className="text-blue-600 hover:underline">Política de Privacidade</a></li>
            <li>Ter idade igual ou superior a 18 anos</li>
            <li>Utilizar a plataforma exclusivamente para finalidades clínicas lícitas</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            2. Descrição do Serviço
          </h2>
          <p>O NutriPerformance Clinical oferece:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
            <li>Gerenciamento de pacientes com dados clínicos organizados por workspace</li>
            <li>Avaliações nutricionais e físicas com cálculos de suporte (IMC, TMB, GET, composição corporal)</li>
            <li>Análise de interações suplemento-medicamento com base em evidências científicas</li>
            <li>Análise de biodisponibilidade de micronutrientes</li>
            <li>Sugestão de protocolos de suplementação assistida por IA (Gemini)</li>
            <li>Geração de relatórios clínicos em PDF</li>
            <li>Registro de exames laboratoriais e metas de pacientes</li>
          </ul>
          <p className="mt-3 text-xs bg-gray-50 border rounded-lg p-3">
            Todos os recursos de IA são de <strong>apoio à decisão</strong>. O profissional deve validar
            cada análise com seu julgamento clínico antes de aplicar qualquer conduta.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            3. Responsabilidades do Profissional
          </h2>
          <p>Ao utilizar a plataforma, o profissional é responsável por:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-xs">
            <li>Obter consentimento do paciente para o tratamento de seus dados pessoais e de saúde</li>
            <li>Manter o sigilo profissional conforme o Código de Ética do CFN/CONFEF</li>
            <li>Verificar e validar todas as análises antes de aplicá-las clinicamente</li>
            <li>Não compartilhar credenciais de acesso com terceiros não autorizados</li>
            <li>Notificar imediatamente a Plataforma em caso de acesso não autorizado</li>
            <li>Manter os dados dos pacientes atualizados e corretos</li>
            <li>Cumprir a LGPD e demais normas aplicáveis ao tratamento de dados de saúde</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            4. Limitação de Responsabilidade
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 space-y-2">
            <p><strong>A Plataforma não se responsabiliza por:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Decisões clínicas tomadas com base nas análises geradas, independentemente do resultado</li>
              <li>Imprecisões nas análises de IA decorrentes de dados incompletos inseridos pelo profissional</li>
              <li>Danos decorrentes de uso inadequado, fora das finalidades previstas</li>
              <li>Indisponibilidade temporária do serviço por manutenção ou falhas de terceiros</li>
              <li>Perda de dados por falha do usuário em exportar informações antes de encerrar a conta</li>
            </ul>
            <p>
              A responsabilidade total da Plataforma limita-se ao valor pago pelo usuário nos últimos 3 meses.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            5. Tokens e Pagamentos
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Tokens são a unidade de consumo da plataforma — cada análise de IA consome tokens conforme tabela disponível em <a href="/tokens" className="text-blue-600 hover:underline">/tokens</a></li>
            <li>Tokens de planos mensais expiram ao final do ciclo, exceto os de acumulação permitida</li>
            <li>Não há reembolso de tokens já consumidos em análises realizadas</li>
            <li>Cancelamento do plano pode ser feito a qualquer momento, com efeito no próximo ciclo</li>
            <li>Cobranças são processadas por Mercado Pago com proteção PCI DSS</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            6. Propriedade Intelectual
          </h2>
          <p className="text-xs">
            O código, design, base de evidências científicas e modelos de análise são de propriedade exclusiva
            da Plataforma. O profissional retém a propriedade dos dados clínicos de seus pacientes inseridos na plataforma.
            A Plataforma não reivindica propriedade sobre dados de pacientes inseridos pelos usuários.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            7. Suspensão e Encerramento
          </h2>
          <p className="text-xs">
            Podemos suspender ou encerrar o acesso em caso de: violação destes Termos, uso inadequado da plataforma,
            inadimplência, ou solicitação do próprio usuário. Em caso de encerramento, o usuário tem 30 dias para
            exportar seus dados antes da remoção definitiva.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            8. Alterações nos Termos
          </h2>
          <p className="text-xs">
            Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas com
            pelo menos <strong>15 dias de antecedência</strong> por e-mail. O uso continuado após este prazo
            constitui aceitação das novas condições.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            9. Lei Aplicável e Foro
          </h2>
          <p className="text-xs">
            Estes Termos são regidos pelas leis da República Federativa do Brasil. Para resolução de conflitos,
            as partes elegem o foro da Comarca de São Paulo/SP, com renúncia expressa a qualquer outro,
            por mais privilegiado que seja.
          </p>
        </section>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 not-prose text-xs text-gray-600">
          <p>Dúvidas? Entre em contato:{' '}
            <a href="mailto:dpo@nutriperformance.com.br" className="text-blue-600 hover:underline">
              dpo@nutriperformance.com.br
            </a>
          </p>
        </div>

      </div>
    </article>
  );
}
