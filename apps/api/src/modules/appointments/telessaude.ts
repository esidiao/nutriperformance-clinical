import { randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

/**
 * Telessaúde — lacuna 13 do benchmark.
 *
 * O QUE ISTO É: a integração do FLUXO. A consulta online ganha uma sala, e o
 * sistema entrega o link à pessoa certa no momento certo — o paciente vê no
 * portal, a profissional vê na agenda.
 *
 * O QUE ISTO NÃO É: vídeo nativo. Construir WebRTC com servidores TURN é um
 * produto à parte, custa infraestrutura e não roda numa instância de plano
 * gratuito. Concorrentes como Healthie têm vídeo próprio com gravação; isto
 * não tem, e dizer o contrário seria mentir sobre o que a plataforma entrega.
 *
 * O vídeo vem de fora. A profissional pode usar a sala gerada automaticamente
 * ou colar o link da ferramenta que já usa — e a escolha é dela, porque é ela
 * quem responde pelo sigilo do atendimento.
 */

/**
 * Serviço público de sala, sem conta e sem instalação.
 *
 * Escolhido porque o paciente abre no navegador do celular sem baixar nada —
 * qualquer barreira a mais e a consulta não acontece. O contraponto, que
 * precisa aparecer na tela e não só aqui: é um serviço de TERCEIRO, e a
 * conversa clínica passa por ele. Quem decide se isso é aceitável para o
 * atendimento é a profissional, não o software.
 */
const BASE_SALA = 'https://meet.jit.si/';

/**
 * Nome da sala: aleatório, nunca derivado do id da consulta ou do paciente.
 *
 * Sala com nome previsível é sala que estranho entra. Num serviço público,
 * qualquer pessoa que adivinhe o nome está dentro da consulta — e num
 * atendimento de saúde isso não é constrangimento, é quebra de sigilo.
 */
export function gerarSala(): string {
  return `${BASE_SALA}npc-${randomBytes(12).toString('hex')}`;
}

/** Minutos antes do início em que o link fica disponível ao paciente. */
export const ABRE_ANTES_MIN = 15;

/** Minutos depois do fim em que o link ainda funciona. */
export const FECHA_DEPOIS_MIN = 120;

/**
 * O link já pode ser mostrado ao paciente?
 *
 * Uma sala visível o tempo todo no portal é uma porta permanente: o link fica
 * lá semanas depois, e qualquer um com acesso ao aparelho entra numa sala que
 * a profissional acha que ninguém usa mais. A janela existe para o link ser
 * útil na hora da consulta e inerte no resto do tempo.
 *
 * A folga depois do fim cobre a consulta que passa do horário — encerrar a
 * sala às 15h em ponto derrubaria a conversa no meio.
 */
export function linkDisponivel(inicio: Date, fim: Date, agora = new Date()): boolean {
  const abre = new Date(new Date(inicio).getTime() - ABRE_ANTES_MIN * 60_000);
  const fecha = new Date(new Date(fim).getTime() + FECHA_DEPOIS_MIN * 60_000);
  return agora >= abre && agora <= fecha;
}

/**
 * Valida o link que a profissional colou.
 *
 * Só https. O link é renderizado como algo clicável para o paciente: aceitar
 * `javascript:` ou `data:` transformaria o campo numa via de execução dentro
 * do navegador dele. E `http://` numa consulta de saúde entrega a conversa em
 * texto claro na rede.
 */
export function validarLinkVideo(bruto: unknown): string {
  const texto = String(bruto ?? '').trim();
  if (!texto) throw new BadRequestException('Informe o link da sala.');
  if (texto.length > 500) throw new BadRequestException('Link longo demais.');

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new BadRequestException('Link inválido. Cole o endereço completo, começando com https://');
  }

  if (url.protocol !== 'https:') {
    throw new BadRequestException(
      'O link precisa começar com https:// — uma consulta não deve trafegar sem criptografia.',
    );
  }
  return url.toString();
}

export const ORIGENS = ['gerado', 'proprio'] as const;
