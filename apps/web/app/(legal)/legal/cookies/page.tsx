import { Calendar } from 'lucide-react';

export const metadata = { title: 'Política de Cookies — NutriPerformance Clinical' };

export default function CookiesPage() {
  return (
    <article className="prose prose-sm max-w-none">
      <div className="not-prose mb-8">
        <div className="text-blue-600 text-xs font-medium mb-3 uppercase tracking-wide">🍪 Documento Legal</div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Política de Cookies</h1>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Versão 1.0 — 24/05/2026</span>
        </div>
      </div>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            O que são cookies?
          </h2>
          <p className="text-xs">
            Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você acessa um site.
            Utilizamos também <strong>localStorage</strong> e <strong>sessionStorage</strong> do navegador para armazenar preferências
            locais que nunca são enviadas ao servidor.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            Cookies que utilizamos
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[460px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Nome / Chave</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Finalidade</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Expiração</th>
                  <th className="px-3 py-2 text-left font-semibold border border-gray-200">Essencial?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['sb-*-auth-token', 'Cookie HttpOnly', 'Sessão de autenticação Supabase', '7 dias (renovável)', '✅ Sim'],
                  ['sb-*-auth-token-code-verifier', 'Cookie HttpOnly', 'Verificação PKCE para OAuth', 'Sessão', '✅ Sim'],
                  ['np_onboarding_dismissed', 'localStorage', 'Ocultar banner de boas-vindas', 'Permanente (local)', '✅ Sim'],
                  ['np_cookie_consent', 'localStorage', 'Registrar aceite desta política', 'Permanente (local)', '✅ Sim'],
                  ['theme', 'localStorage', 'Preferência de tema claro/escuro', 'Permanente (local)', '✅ Sim'],
                ].map(([nome, tipo, fin, exp, ess]) => (
                  <tr key={nome} className="border border-gray-200">
                    <td className="px-3 py-2 font-mono bg-gray-50">{nome}</td>
                    <td className="px-3 py-2">{tipo}</td>
                    <td className="px-3 py-2">{fin}</td>
                    <td className="px-3 py-2 text-gray-500">{exp}</td>
                    <td className="px-3 py-2 text-green-700">{ess}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
            <strong>Apenas cookies essenciais.</strong> O NutriPerformance Clinical não utiliza cookies de rastreamento,
            publicidade, analytics de terceiros ou redes sociais. Não há pixels de tracking, Google Analytics,
            Facebook Pixel ou ferramentas similares.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            Como gerenciar cookies
          </h2>
          <p className="text-xs mb-3">
            Como utilizamos apenas cookies essenciais, desabilitá-los pode impedir o funcionamento correto da plataforma
            (incluindo a autenticação). Você pode gerenciar cookies diretamente no seu navegador:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies</li>
            <li><strong>Firefox:</strong> Preferências → Privacidade e Segurança → Cookies</li>
            <li><strong>Safari:</strong> Preferências → Privacidade → Cookies</li>
            <li><strong>Edge:</strong> Configurações → Privacidade, pesquisa e serviços → Cookies</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-200">
            Base legal
          </h2>
          <p className="text-xs">
            O uso de cookies essenciais baseia-se no <strong>legítimo interesse</strong> (LGPD Art. 7, IX)
            para o funcionamento técnico da plataforma e na <strong>execução de contrato</strong> (Art. 7, V),
            uma vez que sem autenticação não é possível prestar o serviço contratado.
          </p>
        </section>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 not-prose text-xs text-gray-600">
          Dúvidas?{' '}
          <a href="mailto:dpo@nutriperformance.com.br" className="text-blue-600 hover:underline">
            dpo@nutriperformance.com.br
          </a>
        </div>

      </div>
    </article>
  );
}
