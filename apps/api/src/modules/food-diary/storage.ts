/**
 * Acesso ao Supabase Storage por REST.
 *
 * Sem SDK novo de propósito: são três chamadas HTTP, e uma dependência a mais
 * na API significa mais superfície para auditar e mais imagem Docker para
 * construir a cada deploy.
 *
 * A foto NUNCA passa pela API. O paciente envia direto ao Storage com uma URL
 * assinada de curta duração; a API só emite a assinatura e grava o caminho.
 * Isso não é só elegância: a instância no plano gratuito tem memória apertada,
 * e streamar imagens de 8 MB por ela seria o primeiro lugar a cair.
 */

export interface StorageConfig {
  url: string;
  serviceKey: string;
  bucket: string;
}

export function lerConfig(): StorageConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  if (!url || !serviceKey || !bucket) return null;
  return { url, serviceKey, bucket };
}

const cabecalhos = (c: StorageConfig) => ({
  apikey: c.serviceKey,
  Authorization: `Bearer ${c.serviceKey}`,
  'Content-Type': 'application/json',
});

/** Segundos de vida da assinatura de envio. Tempo de tirar a foto e enviar. */
export const VALIDADE_UPLOAD_S = 600;

/**
 * Segundos de vida da assinatura de leitura.
 *
 * Curto de propósito: a URL assinada funciona para qualquer um que a receba, e
 * uma URL longa colada num grupo de mensagens vira acesso à foto do paciente.
 * A tela pede outra quando precisa.
 */
export const VALIDADE_DOWNLOAD_S = 300;

export async function urlDeEnvio(c: StorageConfig, caminho: string) {
  const r = await fetch(
    `${c.url}/storage/v1/object/upload/sign/${c.bucket}/${caminho}`,
    { method: 'POST', headers: cabecalhos(c), body: JSON.stringify({ expiresIn: VALIDADE_UPLOAD_S }) },
  );
  if (!r.ok) throw new Error(`Storage recusou a assinatura de envio (HTTP ${r.status})`);
  const corpo = await r.json();
  // A API devolve o caminho já com o token embutido.
  return { url: `${c.url}/storage/v1${corpo.url}`, expiraEmS: VALIDADE_UPLOAD_S };
}

export async function urlDeLeitura(c: StorageConfig, caminho: string): Promise<string | null> {
  const r = await fetch(
    `${c.url}/storage/v1/object/sign/${c.bucket}/${caminho}`,
    { method: 'POST', headers: cabecalhos(c), body: JSON.stringify({ expiresIn: VALIDADE_DOWNLOAD_S }) },
  );
  // Foto ausente não pode derrubar a listagem inteira do diário: devolve null
  // e a tela mostra o registro sem imagem.
  if (!r.ok) return null;
  const corpo = await r.json();
  return `${c.url}/storage/v1${corpo.signedURL}`;
}

export async function remover(c: StorageConfig, caminho: string): Promise<boolean> {
  const r = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${caminho}`, {
    method: 'DELETE', headers: cabecalhos(c),
  });
  return r.ok;
}

const EXTENSOES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export const TIPOS_ACEITOS = Object.keys(EXTENSOES);

/**
 * Caminho da foto no bucket.
 *
 * Começa pelo workspace para que uma política de Storage por prefixo continue
 * possível no futuro, e termina num id aleatório — nome previsível num bucket
 * privado ainda é pista para quem tenta adivinhar caminhos.
 */
export function caminhoDaFoto(
  workspaceId: string, patientId: string, entryId: string, mime: string,
): string {
  const ext = EXTENSOES[mime];
  if (!ext) throw new Error(`Tipo de imagem não aceito: ${mime}`);
  return `diario/${workspaceId}/${patientId}/${entryId}.${ext}`;
}
