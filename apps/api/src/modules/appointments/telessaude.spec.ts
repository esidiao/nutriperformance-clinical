import {
  gerarSala, linkDisponivel, validarLinkVideo, ABRE_ANTES_MIN, FECHA_DEPOIS_MIN,
} from './telessaude';
import { BadRequestException } from '@nestjs/common';

describe('telessaúde', () => {
  describe('gerarSala', () => {
    it('nunca repete o nome da sala', () => {
      const salas = new Set(Array.from({ length: 500 }, () => gerarSala()));
      expect(salas.size).toBe(500);
    });

    it('o nome é aleatório, não derivado de id', () => {
      // Sala com nome previsível é sala em que estranho entra. Num serviço
      // público, quem adivinhar o nome está dentro da consulta.
      const s = gerarSala();
      expect(s).toMatch(/^https:\/\/meet\.jit\.si\/npc-[0-9a-f]{24}$/);
    });

    it('é https', () => {
      expect(gerarSala().startsWith('https://')).toBe(true);
    });
  });

  describe('linkDisponivel', () => {
    const inicio = new Date('2026-09-10T14:00:00Z');
    const fim = new Date('2026-09-10T15:00:00Z');
    const em = (iso: string) => linkDisponivel(inicio, fim, new Date(iso));

    it('fechado muito antes', () => {
      expect(em('2026-09-09T14:00:00Z')).toBe(false);
    });

    it('fechado 20 minutos antes', () => {
      expect(em('2026-09-10T13:40:00Z')).toBe(false);
    });

    it(`abre ${ABRE_ANTES_MIN} minutos antes`, () => {
      expect(em('2026-09-10T13:45:00Z')).toBe(true);
    });

    it('aberto durante a consulta', () => {
      expect(em('2026-09-10T14:30:00Z')).toBe(true);
    });

    it('continua aberto logo depois do fim', () => {
      // Encerrar às 15h em ponto derrubaria a conversa no meio.
      expect(em('2026-09-10T15:30:00Z')).toBe(true);
    });

    it(`fecha ${FECHA_DEPOIS_MIN} minutos depois do fim`, () => {
      expect(em('2026-09-10T17:01:00Z')).toBe(false);
    });

    it('fechado no dia seguinte', () => {
      // Uma sala visível para sempre é porta permanente no portal.
      expect(em('2026-09-11T14:00:00Z')).toBe(false);
    });
  });

  describe('validarLinkVideo', () => {
    it('aceita https', () => {
      expect(validarLinkVideo('https://meet.google.com/abc-defg-hij'))
        .toBe('https://meet.google.com/abc-defg-hij');
    });

    it('recusa http — consulta não trafega em texto claro', () => {
      expect(() => validarLinkVideo('http://meet.google.com/x')).toThrow(/https/);
    });

    it('recusa javascript:', () => {
      // O link é renderizado como clicável para o paciente. Aceitar isto seria
      // uma via de execução dentro do navegador dele.
      expect(() => validarLinkVideo('javascript:alert(1)')).toThrow(BadRequestException);
    });

    it('recusa data:', () => {
      expect(() => validarLinkVideo('data:text/html,<script>alert(1)</script>'))
        .toThrow(BadRequestException);
    });

    it('recusa texto que não é URL', () => {
      expect(() => validarLinkVideo('minha sala do zoom')).toThrow(/https:\/\//);
    });

    it('recusa vazio', () => {
      expect(() => validarLinkVideo('')).toThrow(/Informe o link/);
      expect(() => validarLinkVideo(null)).toThrow(/Informe o link/);
    });

    it('recusa link absurdamente longo', () => {
      expect(() => validarLinkVideo(`https://x.com/${'a'.repeat(600)}`)).toThrow(/longo/);
    });

    it('tolera espaços em volta', () => {
      expect(validarLinkVideo('  https://zoom.us/j/123  ')).toBe('https://zoom.us/j/123');
    });
  });
});
