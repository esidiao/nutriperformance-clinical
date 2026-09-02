import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, GoneException } from '@nestjs/common';
import { PreConsultService, gerarToken, hashToken } from './pre-consult.service';
import { PreConsultForm } from './pre-consult-form.entity';
import { AuditService } from '../audit/audit.service';
import { validarRespostas, TODAS_PERGUNTAS, QUESTIONARIO } from './questionario';

const WS = 'ws-1';
const USER = 'user-1';

const form = (over: Partial<PreConsultForm> = {}): any => ({
  id: 'f-1', workspaceId: WS, patientId: 'p-1', appointmentId: null, createdBy: USER,
  tokenHash: 'hash', status: 'pendente',
  expiraEm: new Date(Date.now() + 864e5), versaoQuestionario: 1,
  respostas: null, respondidoEm: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('PreConsultService', () => {
  let svc: PreConsultService;
  let repo: any;
  let audit: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: 'f-1', ...d })),
      find: jest.fn(async () => []),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'f-1' })),
      update: jest.fn(),
    };
    audit = { log: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        PreConsultService,
        { provide: getRepositoryToken(PreConsultForm), useValue: repo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(PreConsultService);
  });

  // ── Token ─────────────────────────────────────────────────────────────────
  describe('token', () => {
    it('é longo e não se repete', () => {
      const tokens = new Set(Array.from({ length: 200 }, () => gerarToken()));
      expect(tokens.size).toBe(200);
      expect([...tokens][0].length).toBeGreaterThanOrEqual(40);
    });

    it('é seguro para URL — sem +, / ou =', () => {
      for (let i = 0; i < 50; i++) {
        expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('o banco guarda só o hash, nunca o token', async () => {
      const { form: f, token } = await svc.criar(WS, USER, { patientId: 'p-1' });
      expect(f.tokenHash).toBe(hashToken(token));
      expect(f.tokenHash).not.toBe(token);
      // Nenhum campo do registro pode conter o token em claro.
      expect(JSON.stringify(f)).not.toContain(token);
    });

    it('devolve o token uma vez, na criação', async () => {
      const r = await svc.criar(WS, USER, { patientId: 'p-1' });
      expect(r.token).toBeTruthy();
    });
  });

  // ── Criação ───────────────────────────────────────────────────────────────
  describe('criar', () => {
    it('exige paciente', async () => {
      await expect(svc.criar(WS, USER, {})).rejects.toThrow(/patientId/);
    });

    it('validade padrão de 14 dias', async () => {
      const { form: f } = await svc.criar(WS, USER, { patientId: 'p-1' });
      const dias = Math.round((new Date(f.expiraEm).getTime() - Date.now()) / 864e5);
      expect(dias).toBe(14);
    });

    it('recusa validade acima do teto', async () => {
      await expect(svc.criar(WS, USER, { patientId: 'p-1', diasValidade: 365 }))
        .rejects.toThrow(/porta permanente/);
    });

    it('recusa validade zero ou negativa', async () => {
      await expect(svc.criar(WS, USER, { patientId: 'p-1', diasValidade: 0 }))
        .rejects.toThrow(BadRequestException);
    });

    it('grava a versão do questionário', async () => {
      const { form: f } = await svc.criar(WS, USER, { patientId: 'p-1' });
      expect(f.versaoQuestionario).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Superfície pública ────────────────────────────────────────────────────
  describe('abrirPublico', () => {
    it('token curto nem chega ao banco', async () => {
      await expect(svc.abrirPublico('abc')).rejects.toThrow(NotFoundException);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('não vaza NENHUM dado do paciente', async () => {
      repo.findOne.mockResolvedValue(form());
      const r: any = await svc.abrirPublico('t'.repeat(43));
      const chaves = Object.keys(r);
      expect(chaves.sort()).toEqual(['expiraEm', 'questionario', 'versao']);
      // Quem tem o link pode ser quem recebeu o encaminhamento por engano.
      const texto = JSON.stringify(r);
      expect(texto).not.toContain('p-1');   // patientId
      expect(texto).not.toContain('ws-1');  // workspaceId
      expect(texto).not.toContain('f-1');   // id do formulário
      expect(texto).not.toContain('hash');  // tokenHash
    });

    it('cancelado responde igual a inexistente', async () => {
      repo.findOne.mockResolvedValue(form({ status: 'cancelado' }));
      const cancelado = await svc.abrirPublico('t'.repeat(43)).catch((e) => e);

      repo.findOne.mockResolvedValue(null);
      const inexistente = await svc.abrirPublico('t'.repeat(43)).catch((e) => e);

      // Quem sonda não pode distinguir "não existe" de "existe e foi cancelado".
      expect(cancelado.constructor).toBe(inexistente.constructor);
      expect(cancelado.message).toBe(inexistente.message);
    });

    it('expirado avisa com clareza', async () => {
      repo.findOne.mockResolvedValue(form({ expiraEm: new Date(Date.now() - 864e5) }));
      await expect(svc.abrirPublico('t'.repeat(43))).rejects.toThrow(GoneException);
    });

    it('já respondido avisa com clareza', async () => {
      repo.findOne.mockResolvedValue(form({ status: 'respondido' }));
      await expect(svc.abrirPublico('t'.repeat(43))).rejects.toThrow(/já foi respondido/);
    });

    it('busca pelo hash, nunca pelo token em claro', async () => {
      repo.findOne.mockResolvedValue(form());
      const token = 't'.repeat(43);
      await svc.abrirPublico(token);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { tokenHash: hashToken(token) } });
    });
  });

  describe('responderPublico', () => {
    const validas = { objetivo: 'Emagrecer', recordatorio: 'Café, almoço e janta' };

    it('grava e fecha o formulário', async () => {
      repo.findOne.mockResolvedValue(form());
      await svc.responderPublico('t'.repeat(43), validas);
      expect(repo.update).toHaveBeenCalledWith('f-1', expect.objectContaining({
        status: 'respondido',
      }));
    });

    it('não aceita segunda resposta', async () => {
      // Sem isto, qualquer um com o link sobrescreveria o que o paciente
      // respondeu, e o prontuário registraria a última pessoa que abriu.
      repo.findOne.mockResolvedValue(form({ status: 'respondido' }));
      await expect(svc.responderPublico('t'.repeat(43), validas)).rejects.toThrow(GoneException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('não aceita depois de expirar', async () => {
      repo.findOne.mockResolvedValue(form({ expiraEm: new Date(Date.now() - 1000) }));
      await expect(svc.responderPublico('t'.repeat(43), validas)).rejects.toThrow(GoneException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('não aceita link cancelado', async () => {
      repo.findOne.mockResolvedValue(form({ status: 'cancelado' }));
      await expect(svc.responderPublico('t'.repeat(43), validas)).rejects.toThrow(NotFoundException);
    });

    it('recusa quando falta obrigatória', async () => {
      repo.findOne.mockResolvedValue(form());
      await expect(svc.responderPublico('t'.repeat(43), { objetivo: 'x' }))
        .rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('registra que veio de fora, não de um usuário logado', async () => {
      // A origem vai no changes, não no userId: user_id é uuid em produção e o
      // texto derrubava o INSERT — a resposta do paciente não era auditada.
      repo.findOne.mockResolvedValue(form());
      await svc.responderPublico('t'.repeat(43), validas);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        changes: expect.objectContaining({ origem: 'paciente-via-link' }),
      }));
      expect(audit.log.mock.calls[0][0].userId).toBeUndefined();
    });
  });

  describe('cancelar', () => {
    it('não cancela respondido — a resposta é registro do paciente', async () => {
      repo.findOne.mockResolvedValue(form({ status: 'respondido' }));
      await expect(svc.cancelar(WS, USER, 'f-1')).rejects.toThrow(/registro do paciente/);
    });

    it('404 para formulário de outro workspace', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.cancelar(WS, USER, 'f-x')).rejects.toThrow(NotFoundException);
    });
  });
});

describe('validação das respostas', () => {
  it('descarta chave desconhecida em vez de gravar', () => {
    // A rota é pública: aceitar campo arbitrário deixaria qualquer um usar o
    // prontuário como depósito de texto.
    const { respostas } = validarRespostas({
      objetivo: 'Emagrecer', recordatorio: 'x', campo_invadido: 'lixo',
    });
    expect(respostas).not.toHaveProperty('campo_invadido');
  });

  it('recusa texto absurdamente longo', () => {
    const { erros } = validarRespostas({
      objetivo: 'a'.repeat(5000), recordatorio: 'x',
    });
    expect(erros.some((e) => e.perguntaId === 'objetivo')).toBe(true);
  });

  it('recusa opção fora da lista', () => {
    const { erros } = validarRespostas({
      objetivo: 'x', recordatorio: 'y', intestino: 'opcao inventada',
    });
    expect(erros.some((e) => e.perguntaId === 'intestino')).toBe(true);
  });

  it('recusa item inválido em múltipla escolha', () => {
    const { erros } = validarRespostas({
      objetivo: 'x', recordatorio: 'y', restricao: ['Vegana', 'invalida'],
    });
    expect(erros.some((e) => e.perguntaId === 'restricao')).toBe(true);
  });

  it('aceita múltipla escolha válida', () => {
    const { erros, respostas } = validarRespostas({
      objetivo: 'x', recordatorio: 'y', restricao: ['Vegana', 'Sem glúten'],
    });
    expect(erros).toHaveLength(0);
    expect(respostas.restricao).toEqual(['Vegana', 'Sem glúten']);
  });

  it('respeita limites numéricos', () => {
    const { erros } = validarRespostas({
      objetivo: 'x', recordatorio: 'y', horas_sono: 99,
    });
    expect(erros.some((e) => e.perguntaId === 'horas_sono')).toBe(true);
  });

  it('sim_não exige booleano, não a string "sim"', () => {
    const { erros } = validarRespostas({
      objetivo: 'x', recordatorio: 'y', acompanhamento_anterior: 'sim',
    });
    expect(erros.some((e) => e.perguntaId === 'acompanhamento_anterior')).toBe(true);
  });

  it('entrada nula não quebra', () => {
    const { erros } = validarRespostas(null);
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe('questionário', () => {
  it('não repete id de pergunta', () => {
    // Um id reaproveitado faria a resposta antiga responder outra pergunta.
    const ids = TODAS_PERGUNTAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('escolha e múltipla sempre têm opções', () => {
    for (const p of TODAS_PERGUNTAS) {
      if (p.tipo === 'escolha' || p.tipo === 'multipla') {
        expect(p.opcoes?.length ?? 0).toBeGreaterThan(1);
      }
    }
  });

  it('nenhuma seção fica vazia', () => {
    for (const s of QUESTIONARIO) expect(s.perguntas.length).toBeGreaterThan(0);
  });
});
