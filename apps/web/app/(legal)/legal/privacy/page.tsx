import { ShieldCheck, Calendar, Mail } from 'lucide-react';

export const metadata = { title: 'Política de Privacidade — NutriPerformance Clinical' };

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-none">
      {/* Header */}
      <div className="not-prose mb-8">
        <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-3 uppercase tracking-wide">
          <ShieldCheck className="h-4 w-4" />
          Documento Legal
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Versão 1.0 — 24/05/2026</span>
          <span>Próxima revisão: 24/05/2027</span>
        </div>
      </div>

      {/* Intro */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 not-prose">
        <p className="text-sm text-blue-800 leading-relaxed">
          A <strong>NutriPerformance Clinical</strong> ("Plataforma", "nós") respeita sua privacidade e está comprometida
          com a proteção dos seus dados pessoais conforme a <strong>Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)</strong>,
          o Código de Ética do Nutricionista (CFN), a Resolução CFN 599/2018 e o CONFEF.
          Esta Política descreve como coletamos, usamos, armazenamos e protegemos seus dados.
        </p>
      </div>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        {/* 1 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            1. Quem somos (Controlador dos Dados)
          </h2>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {[
                ['Controlador', 'NutriPerformance Clinical (operado por pessoa jurídica a ser constituída)'],
                ['E-mail', 'dpo@nutriperformance.com.br'],
                ['DPO / Encarregado', 'Disponível via e-mail acima'],
                ['Base jurídica', 'Brasil — LGPD (Lei 13.709/2018)'],
              ].map(([k, v]) => (
                <tr key={k} className="border border-gray-200">
                  <td className="px-3 py-2 bg-gray-50 font-semibold text-gray-700 w-36">{k}</td>
                  <td className="px-3 py-2 text-gray-600">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 2 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            2. Dados que coletamos e base legal
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Categoria</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Dados</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Base Legal (LGPD)</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Finalidade</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Retenção</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Cadastro profissional', 'Nome, e-mail, conselho (CFN/CREF), telefone', 'Contrato (Art. 7, V)', 'Autenticação e operação da plataforma', 'Enquanto a conta estiver ativa + 1 ano'],
                  ['Dados de pacientes', 'Código interno, idade, sexo, objetivo clínico', 'Consentimento explícito (Art. 11, I)', 'Acompanhamento clínico', 'Enquanto o profissional mantiver o cadastro + 90 dias após exclusão'],
                  ['Dados de saúde (sensíveis)', 'Avaliações nutricionais/físicas, exames, medicamentos, suplementos', 'Consentimento explícito (Art. 11, I) + tutela da saúde (Art. 11, II, f)', 'Análise clínica de apoio ao profissional', 'Mesmo prazo dos dados do paciente'],
                  ['Logs de auditoria', 'IP, e-mail do profissional, ação realizada, data/hora', 'Obrigação legal (Art. 7, II) + legítimo interesse (Art. 7, IX)', 'Rastreabilidade, segurança e conformidade LGPD', '5 anos (imutável)'],
                  ['Uso da plataforma', 'Tokens consumidos, módulos acessados', 'Contrato (Art. 7, V)', 'Cobrança e melhoria do serviço', '12 meses após encerramento'],
                  ['Cookies essenciais', 'Sessão de autenticação (Supabase)', 'Legítimo interesse (Art. 7, IX)', 'Manter sessão ativa e segura', 'Sessão ou 7 dias (refresh token)'],
                ].map(([cat, dados, base, fin, ret]) => (
                  <tr key={cat} className="border border-gray-200">
                    <td className="px-3 py-2 bg-gray-50 font-medium">{cat}</td>
                    <td className="px-3 py-2">{dados}</td>
                    <td className="px-3 py-2 text-blue-700">{base}</td>
                    <td className="px-3 py-2">{fin}</td>
                    <td className="px-3 py-2 text-gray-500">{ret}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <strong>⚠️ Dados de saúde são dados sensíveis</strong> (LGPD Art. 11). São coletados exclusivamente para
            apoiar o trabalho clínico de profissionais de saúde habilitados (CFN/CONFEF) e nunca são
            usados para fins comerciais, publicitários ou compartilhados com terceiros sem consentimento explícito.
          </p>
        </section>

        {/* 3 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            3. Como protegemos seus dados
          </h2>
          <ul className="space-y-2 list-none pl-0">
            {[
              ['🔒 Criptografia em trânsito', 'TLS 1.3 em todas as comunicações'],
              ['🔐 Criptografia em repouso', 'AES-256 para dados armazenados no banco de dados'],
              ['🔑 CPF / dados identificáveis', 'Hash SHA-256 — o valor original nunca é armazenado'],
              ['🏗️ Infraestrutura', 'Supabase (PostgreSQL gerenciado, ISO 27001, SOC 2 Type II)'],
              ['👁️ Controle de acesso', 'Row Level Security (RLS) — cada workspace acessa apenas seus próprios dados'],
              ['📋 Audit trail', 'Todos os acessos a dados de pacientes são registrados com IP, usuário e timestamp'],
              ['🗑️ Soft-delete', 'Dados "excluídos" ficam em quarentena por 90 dias antes da remoção definitiva'],
            ].map(([icon, desc]) => (
              <li key={icon as string} className="flex items-start gap-2 text-xs">
                <span className="text-base leading-none mt-0.5">{(icon as string).split(' ')[0]}</span>
                <span><strong>{(icon as string).substring(3)}</strong> — {desc}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            4. Compartilhamento de dados
          </h2>
          <p className="mb-3">Não vendemos, alugamos nem comercializamos seus dados. Compartilhamos apenas com:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Terceiro (Processador)</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Finalidade</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Localização</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Garantias</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Supabase Inc.', 'Banco de dados, autenticação, armazenamento', 'EUA (com DPA)', 'SOC 2, ISO 27001, GDPR'],
                  ['Vercel Inc.', 'Hospedagem do frontend', 'EUA/Global CDN', 'SOC 2 Type II, GDPR'],
                  ['Google (Gemini API)', 'Análises de IA — dados anonimizados/sem PII', 'EUA', 'GDPR, Data Processing Addendum'],
                  ['Railway', 'Hospedagem da API backend', 'EUA', 'SOC 2'],
                ].map(([t, f, l, g]) => (
                  <tr key={t} className="border border-gray-200">
                    <td className="px-3 py-2 font-medium bg-gray-50">{t}</td>
                    <td className="px-3 py-2">{f}</td>
                    <td className="px-3 py-2">{l}</td>
                    <td className="px-3 py-2 text-green-700">{g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Transferências internacionais são realizadas com salvaguardas adequadas conforme LGPD Art. 33.
          </p>
        </section>

        {/* 5 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            5. Seus direitos (LGPD Art. 18)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { dir: 'Acesso', desc: 'Confirmar se tratamos seus dados e obter cópia', link: '/legal/dados' },
              { dir: 'Retificação', desc: 'Corrigir dados incompletos ou desatualizados', link: '/legal/dados' },
              { dir: 'Exclusão', desc: 'Solicitar eliminação dos dados pessoais', link: '/legal/dados' },
              { dir: 'Portabilidade', desc: 'Receber seus dados em formato estruturado (JSON/CSV)', link: '/legal/dados' },
              { dir: 'Oposição', desc: 'Opor-se a tratamento realizado com base em legítimo interesse', link: '/legal/dados' },
              { dir: 'Revogação', desc: 'Retirar consentimento a qualquer momento', link: '/legal/dados' },
              { dir: 'Anonimização / Bloqueio', desc: 'Solicitar bloqueio de dados desnecessários', link: '/legal/dados' },
              { dir: 'Informação sobre terceiros', desc: 'Saber com quem compartilhamos seus dados', link: null },
            ].map(({ dir, desc, link }) => (
              <div key={dir} className="border border-gray-200 rounded-lg p-3 bg-white">
                <p className="font-semibold text-gray-800 text-xs mb-1">✅ {dir}</p>
                <p className="text-gray-500 text-xs">{desc}</p>
                {link && (
                  <a href={link} className="text-blue-600 text-xs hover:underline mt-1 inline-block">
                    Exercer este direito →
                  </a>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
            Respondemos a solicitações em até <strong>15 dias úteis</strong> (LGPD Art. 19).
            Para exercer seus direitos, acesse <a href="/legal/dados" className="text-blue-600 hover:underline">Central de Direitos</a> ou
            envie um e-mail para <a href="mailto:dpo@nutriperformance.com.br" className="text-blue-600 hover:underline">dpo@nutriperformance.com.br</a>.
          </p>
        </section>

        {/* 6 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            6. Cookies e armazenamento local
          </h2>
          <p>Utilizamos apenas cookies essenciais para o funcionamento da plataforma. Veja nossa
            <a href="/legal/cookies" className="text-blue-600 hover:underline ml-1">Política de Cookies</a> para detalhes.
          </p>
        </section>

        {/* 7 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            7. Dados de menores
          </h2>
          <p>
            A plataforma é destinada exclusivamente a profissionais de saúde habilitados (CFN/CONFEF) maiores de 18 anos.
            Não coletamos dados diretamente de menores de 18 anos. Dados de pacientes menores de idade
            são registrados por profissionais responsáveis, com responsabilidade legal do profissional sobre o consentimento dos responsáveis.
          </p>
        </section>

        {/* 8 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            8. Incidentes de segurança
          </h2>
          <p>
            Em caso de incidente de segurança que possa acarretar risco ou dano relevante, notificaremos
            a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados no prazo de
            <strong> 72 horas</strong> após a ciência do incidente, conforme LGPD Art. 48.
          </p>
        </section>

        {/* 9 */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            9. Atualizações desta Política
          </h2>
          <p>
            Esta Política pode ser atualizada periodicamente. Quando houver alterações relevantes,
            notificaremos por e-mail e/ou mediante banner na plataforma com pelo menos 15 dias de antecedência.
            A versão em vigor é sempre a disponível nesta página, identificada pela data de atualização.
          </p>
        </section>

        {/* Contact */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 not-prose">
          <p className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" /> Contato — Encarregado pelo Tratamento (DPO)
          </p>
          <p className="text-xs text-green-800 leading-relaxed">
            Para dúvidas, solicitações ou exercício de direitos LGPD: <br />
            <a href="mailto:dpo@nutriperformance.com.br" className="font-medium underline">
              dpo@nutriperformance.com.br
            </a>
            {' '}· Prazo de resposta: até 15 dias úteis
          </p>
          <p className="text-xs text-green-700 mt-2">
            Você também pode contatar a <strong>ANPD</strong> (Autoridade Nacional de Proteção de Dados)
            em <a href="https://www.gov.br/anpd" target="_blank" rel="noopener" className="underline">gov.br/anpd</a>.
          </p>
        </div>

      </div>
    </article>
  );
}
