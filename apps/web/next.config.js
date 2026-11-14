/** @type {import('next').NextConfig} */
// PWA desativado temporariamente — next-pwa@5.6 era unmaintained (CVEs),
// @ducanh2912/next-pwa@10 tem conflito de peer com Next.js 15.
// Reintegrar via @serwist/next quando estabilizar suporte ao Next 15.

const nextConfig = {
  // Never expose source maps in production — they reveal full application source code.
  productionBrowserSourceMaps: false,

  /**
   * Otimizador de imagem DESLIGADO, e isto é redução de superfície de ataque,
   * não economia.
   *
   * O app não importa `next/image` em nenhum arquivo — todas as imagens são
   * `<img>`. Mas o endpoint `/_next/image` existe e é publicamente roteável em
   * qualquer deploy do Next, independentemente de o aplicativo usá-lo. Ele
   * aceita qualquer URL que passe pela allowlist de `images.remotePatterns` e
   * manda o arquivo para o `sharp` analisar.
   *
   * Em 14/11/2026 isso formava uma cadeia completa:
   *
   *   1. `remotePatterns` liberava o host do Supabase Storage;
   *   2. o upload de foto (diário alimentar, rota `@Public()` cuja credencial
   *      é o token do link) valida o tipo com `dto.mimeFoto`, um campo do corpo
   *      da requisição — não lê um byte do arquivo. Declarar `image/png` e
   *      enviar outro conteúdo passa;
   *   3. `next@15.5.25` está na faixa da CVE-2026-96889 (GHSA-2464-fhr4-w9xw),
   *      com `sharp@0.35.4` carregando um `librsvg` vulnerável. A análise
   *      pública indica que `sharp().metadata()` analisa o arquivo ANTES da
   *      checagem de `dangerouslyAllowSVG` — então não ter essa opção ligada
   *      reduz a exposição, mas não é fronteira de análise.
   *
   * O Next foi atualizado, o que corrige a causa. Isto aqui fecha o caminho:
   * sem o otimizador e sem allowlist remota, não há o que alcançar — e o
   * produto não perde nada, porque não usava o recurso.
   *
   * Se um dia alguém for usar `next/image`, religar exige decidir de novo
   * qual host entra na allowlist, e o passo 2 (verificar os bytes, não o MIME
   * declarado pelo cliente) precisa estar resolvido antes.
   *
   * O host do Supabase continua liberado em `img-src` na CSP do middleware —
   * é de lá que as fotos são servidas direto para o `<img>`, sem passar por
   * otimizador.
   */
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
