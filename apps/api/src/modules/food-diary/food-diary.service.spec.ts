import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, GoneException } from '@nestjs/common';
import { FoodDiaryService, hashToken, gerarToken } from './food-diary.service';
import { FoodDiaryLink, FoodDiaryEntry } from './food-diary.entities';
import { AuditService } from '../audit/audit.service';
import { caminhoDaFoto, TIPOS_ACEITOS, VALIDADE_DOWNLOAD_S, VALIDADE_UPLOAD_S } from './storage';
import * as storage from './storage';
import { MESES_RETENCAO_FOTO } from './food-diary.service';

const WS = 'ws-1';
const USER = 'user-1';
const TOKEN = 't'.repeat(43);

const link = (over: Partial<FoodDiaryLink> = {}): any => ({
  id: 'l-1', workspaceId: WS, patientId: 'p-1', createdBy: USER,
  tokenHash: hashToken(TOKEN), status: 'ativo',
  expiraEm: new Date(Date.now() + 864e5),
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

const entry = (over: Partial<FoodDiaryEntry> = {}): any => ({
  id: 'e-1', workspaceId: WS, patientId: 'p-1', linkId: 'l-1',
  refeicao: 'almoco', descricao: 'Arroz e feijão', fotoPath: null,
  tomadaEm: new Date(), origem: 'paciente', comentario: null,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});

describe('FoodDiaryService', () => {
  let svc: FoodDiaryService;
  let linkRepo: any;
  let entryRepo: any;
  let audit: any;

  beforeEach(async () => {
    linkRepo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'l-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'l-1' })), update: jest.fn(),
    };
    entryRepo = {
      create: jest.fn((d) => d), save: jest.fn(async (d) => ({ id: 'e-1', ...d })),
      find: jest.fn(async () => []), findOne: jest.fn(),
      findOneOrFail: jest.fn(async () => ({ id: 'e-1' })), update: jest.fn(),
      count: jest.fn(async () => 0),
    };
    audit = { log: jest.fn() };

    const mod = await Test.createTestingModule({
      providers: [
        FoodDiaryService,
        { provide: getRepositoryToken(FoodDiaryLink), useValue: linkRepo },
        { provide: getRepositoryToken(FoodDiaryEntry), useValue: entryRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(FoodDiaryService);

    // Sem config de storage nos testes: exercita o caminho só-texto e garante
    // que nenhum teste dependa de rede.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_STORAGE_BUCKET;
  });

  // ── Link ──────────────────────────────────────────────────────────────────
  describe('criarLink', () => {
    it('guarda hash, nunca o token', async () => {
      const { link: l, token } = await svc.criarLink(WS, USER, { patientId: 'p-1' });
      expect(l.tokenHash).toBe(hashToken(token));
      expect(JSON.stringify(l)).not.toContain(token);
    });

    it('validade padrão de 30 dias', async () => {
      const { link: l } = await svc.criarLink(WS, USER, { patientId: 'p-1' });
      const dias = Math.round((new Date(l.expiraEm).getTime() - Date.now()) / 864e5);
      expect(dias).toBe(30);
    });

    it('recusa validade acima do teto', async () => {
      await expect(svc.criarLink(WS, USER, { patientId: 'p-1', diasValidade: 365 }))
        .rejects.toThrow(/acesso permanente/);
    });

    it('exige paciente', async () => {
      await expect(svc.criarLink(WS, USER, {})).rejects.toThrow(/patientId/);
    });
  });

  // ── Superfície pública ────────────────────────────────────────────────────
  describe('abrirPublico', () => {
    it('token curto nem chega ao banco', async () => {
      await expect(svc.abrirPublico('abc')).rejects.toThrow(NotFoundException);
      expect(linkRepo.findOne).not.toHaveBeenCalled();
    });

    it('revogado responde igual a inexistente', async () => {
      linkRepo.findOne.mockResolvedValue(link({ status: 'revogado' }));
      const revogado = await svc.abrirPublico(TOKEN).catch((e) => e);
      linkRepo.findOne.mockResolvedValue(null);
      const inexistente = await svc.abrirPublico(TOKEN).catch((e) => e);
      expect(revogado.constructor).toBe(inexistente.constructor);
      expect(revogado.message).toBe(inexistente.message);
    });

    it('expirado avisa com clareza', async () => {
      linkRepo.findOne.mockResolvedValue(link({ expiraEm: new Date(Date.now() - 1000) }));
      await expect(svc.abrirPublico(TOKEN)).rejects.toThrow(GoneException);
    });

    it('não devolve o comentário da profissional', async () => {
      // É anotação clínica, escrita para o prontuário — não para ser lida sem
      // contexto por quem está do outro lado do link.
      linkRepo.findOne.mockResolvedValue(link());
      entryRepo.find.mockResolvedValue([entry({ comentario: 'Excesso de carboidrato' })]);
      const r: any = await svc.abrirPublico(TOKEN);
      expect(JSON.stringify(r)).not.toContain('Excesso de carboidrato');
      expect(r.registros[0]).not.toHaveProperty('comentario');
    });

    it('não vaza identificadores do paciente', async () => {
      linkRepo.findOne.mockResolvedValue(link());
      entryRepo.find.mockResolvedValue([entry()]);
      const r: any = await svc.abrirPublico(TOKEN);
      const texto = JSON.stringify(r);
      expect(texto).not.toContain('p-1');
      expect(texto).not.toContain('ws-1');
    });

    it('não devolve o caminho da foto no bucket', async () => {
      linkRepo.findOne.mockResolvedValue(link());
      entryRepo.find.mockResolvedValue([entry({ fotoPath: 'diario/ws-1/p-1/e-1.jpg' })]);
      const r: any = await svc.abrirPublico(TOKEN);
      expect(JSON.stringify(r)).not.toContain('diario/');
    });
  });

  describe('registrarPublico', () => {
    beforeEach(() => linkRepo.findOne.mockResolvedValue(link()));

    it('recusa refeição inválida', async () => {
      await expect(svc.registrarPublico(TOKEN, { refeicao: 'brunch', descricao: 'x' }))
        .rejects.toThrow(/Refeição inválida/);
    });

    it('recusa registro sem foto e sem descrição', async () => {
      await expect(svc.registrarPublico(TOKEN, { refeicao: 'almoco' }))
        .rejects.toThrow(/foto ou descreva/);
    });

    it('aceita só descrição — registro sem foto é válido', async () => {
      const r = await svc.registrarPublico(TOKEN, { refeicao: 'almoco', descricao: 'Salada' });
      expect(r.id).toBe('e-1');
      expect(r.envio).toBeNull();
    });

    it('recusa refeição no futuro', async () => {
      await expect(svc.registrarPublico(TOKEN, {
        refeicao: 'almoco', descricao: 'x', tomadaEm: new Date(Date.now() + 864e5).toISOString(),
      })).rejects.toThrow(/futuro/);
    });

    it('aceita refeição de horas atrás — quase todo mundo registra depois', async () => {
      const r = await svc.registrarPublico(TOKEN, {
        refeicao: 'cafe_manha', descricao: 'Pão',
        tomadaEm: new Date(Date.now() - 6 * 3600_000).toISOString(),
      });
      expect(r.id).toBeTruthy();
    });

    it('recusa formato de imagem não aceito', async () => {
      await expect(svc.registrarPublico(TOKEN, {
        refeicao: 'almoco', descricao: 'x', mimeFoto: 'application/pdf',
      })).rejects.toThrow(/Formato de imagem/);
    });

    it('respeita o teto diário', async () => {
      entryRepo.count.mockResolvedValue(20);
      await expect(svc.registrarPublico(TOKEN, { refeicao: 'almoco', descricao: 'x' }))
        .rejects.toThrow(/Limite de 20/);
    });

    it('recusa descrição gigante', async () => {
      await expect(svc.registrarPublico(TOKEN, {
        refeicao: 'almoco', descricao: 'a'.repeat(5000),
      })).rejects.toThrow(/muito longa/);
    });

    it('registra que veio de fora, não de um usuário logado', async () => {
      await svc.registrarPublico(TOKEN, { refeicao: 'almoco', descricao: 'x' });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'paciente-via-link',
      }));
    });

    it('link revogado não registra nada', async () => {
      linkRepo.findOne.mockResolvedValue(link({ status: 'revogado' }));
      await expect(svc.registrarPublico(TOKEN, { refeicao: 'almoco', descricao: 'x' }))
        .rejects.toThrow(NotFoundException);
      expect(entryRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Adesão ────────────────────────────────────────────────────────────────
  describe('adesão', () => {
    const dia = (n: number) => new Date(Date.now() - n * 864e5);

    it('conta dias distintos, não refeições', async () => {
      // Cinco fotos num dia e sumiço na semana não é adesão de 100%.
      entryRepo.find.mockResolvedValue([
        entry({ tomadaEm: dia(1) }), entry({ tomadaEm: dia(1) }),
        entry({ tomadaEm: dia(1) }), entry({ tomadaEm: dia(1) }),
      ]);
      const r = await svc.listarRegistros(WS, 'p-1', {
        de: dia(3).toISOString(), ate: dia(0).toISOString(),
      });
      expect(r.adesao.diasComRegistro).toBe(1);
      expect(r.adesao.totalRegistros).toBe(4);
    });

    it('percentual sobre os dias do período', async () => {
      entryRepo.find.mockResolvedValue([
        entry({ tomadaEm: dia(0) }), entry({ tomadaEm: dia(1) }),
      ]);
      const r = await svc.listarRegistros(WS, 'p-1', {
        de: dia(3).toISOString(), ate: dia(0).toISOString(),
      });
      expect(r.adesao.diasNoPeriodo).toBe(4);
      expect(r.adesao.percentual).toBe(50);
    });

    it('período sem registro não divide por zero', async () => {
      entryRepo.find.mockResolvedValue([]);
      const r = await svc.listarRegistros(WS, 'p-1', {});
      expect(r.adesao.percentual).toBe(0);
      expect(Number.isFinite(r.adesao.percentual)).toBe(true);
    });

    it('recusa intervalo invertido', async () => {
      await expect(svc.listarRegistros(WS, 'p-1', { de: '2026-12-01', ate: '2026-01-01' }))
        .rejects.toThrow(/anterior/);
    });

    it('a listagem da profissional não expõe o caminho no bucket', async () => {
      entryRepo.find.mockResolvedValue([entry({ fotoPath: 'diario/ws-1/p-1/e-1.jpg' })]);
      const r = await svc.listarRegistros(WS, 'p-1', {});
      expect(r.registros[0].fotoPath).toBeUndefined();
    });
  });

  // ── Retenção ──────────────────────────────────────────────────────────────
  describe('expurgarFotosAntigas', () => {
    const antiga = (n = 3) => entry({
      id: `e-${n}`, fotoPath: `diario/abc/e-${n}.png`,
      createdAt: new Date(Date.now() - 400 * 864e5),
    });

    beforeEach(() => {
      process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
      process.env.SUPABASE_STORAGE_BUCKET = 'bucket';
      jest.restoreAllMocks();
    });

    it('a retenção é de 12 meses', () => {
      expect(MESES_RETENCAO_FOTO).toBe(12);
    });

    it('simular não apaga nada', async () => {
      entryRepo.find.mockResolvedValue([antiga()]);
      const remover = jest.spyOn(storage, 'remover');
      const r = await svc.expurgarFotosAntigas({ simular: true });
      expect(r.simulado).toBe(true);
      expect(r.encontradas).toBe(1);
      expect(remover).not.toHaveBeenCalled();
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('apaga do Storage ANTES de limpar o banco', async () => {
      // Invertido, a linha perderia o caminho e o arquivo ficaria orfao para
      // sempre — sem nada no sistema sabendo que ele existe.
      const ordem: string[] = [];
      jest.spyOn(storage, 'remover').mockImplementation(async () => { ordem.push('storage'); return 1; });
      entryRepo.find.mockResolvedValue([antiga()]);
      entryRepo.update.mockImplementation(async () => { ordem.push('banco'); });
      entryRepo.count.mockResolvedValue(0);

      await svc.expurgarFotosAntigas({});
      expect(ordem).toEqual(['storage', 'banco']);
    });

    it('mantém o registro e marca a data do expurgo', async () => {
      jest.spyOn(storage, 'remover').mockResolvedValue(1);
      entryRepo.find.mockResolvedValue([antiga()]);
      entryRepo.count.mockResolvedValue(0);

      await svc.expurgarFotosAntigas({});
      const [, mudancas] = entryRepo.update.mock.calls[0];
      expect(mudancas.fotoPath).toBeNull();
      expect(mudancas.fotoRemovidaEm).toBeInstanceOf(Date);
      // A linha continua: descricao e horario sao historico clinico.
      expect(mudancas).not.toHaveProperty('descricao');
    });

    it('Storage não confirmando, o banco não é tocado', async () => {
      jest.spyOn(storage, 'remover').mockResolvedValue(0);
      entryRepo.find.mockResolvedValue([antiga()]);
      const r = await svc.expurgarFotosAntigas({});
      expect(entryRepo.update).not.toHaveBeenCalled();
      expect(r.removidas).toBe(0);
      expect(r.erro).toMatch(/não confirmou/);
    });

    it('sem storage configurado, falha sem alterar nada', async () => {
      delete process.env.SUPABASE_URL;
      entryRepo.find.mockResolvedValue([antiga()]);
      await expect(svc.expurgarFotosAntigas({})).rejects.toThrow(/não executado/);
      expect(entryRepo.update).not.toHaveBeenCalled();
    });

    it('nada antigo devolve zero sem chamar o Storage', async () => {
      entryRepo.find.mockResolvedValue([]);
      const remover = jest.spyOn(storage, 'remover');
      const r = await svc.expurgarFotosAntigas({});
      expect(r.encontradas).toBe(0);
      expect(remover).not.toHaveBeenCalled();
    });

    it('recusa retenção menor que um mês', async () => {
      await expect(svc.expurgarFotosAntigas({ meses: 0 })).rejects.toThrow(BadRequestException);
    });

    it('informa quantas ainda restam, para o job saber se repete', async () => {
      jest.spyOn(storage, 'remover').mockResolvedValue(1);
      entryRepo.find.mockResolvedValue([antiga()]);
      entryRepo.count.mockResolvedValue(37);
      const r = await svc.expurgarFotosAntigas({});
      expect(r.restam).toBe(37);
    });
  });
});


describe('storage', () => {
  it('agrupa por paciente sem revelar os identificadores', () => {
    // A URL assinada carrega o caminho do objeto e é entregue na superfície
    // pública. Com os ids crus ali, todo link de foto exibiria workspaceId e
    // patientId — o oposto do que o resto do módulo garante.
    const c = caminhoDaFoto('ws-1', 'p-1', 'e-1', 'image/jpeg');
    expect(c).not.toContain('ws-1');
    expect(c).not.toContain('p-1');
    expect(c).toMatch(/^diario\/[0-9a-f]{32}\/e-1\.jpg$/);
  });

  it('mesmo paciente cai sempre na mesma pasta', () => {
    // Agrupar importa: expurgo por prefixo quando houver retencao.
    expect(caminhoDaFoto('ws-1', 'p-1', 'e-1', 'image/png'))
      .toContain(caminhoDaFoto('ws-1', 'p-1', 'e-9', 'image/png').split('/')[1]);
  });

  it('pacientes diferentes caem em pastas diferentes', () => {
    const a = caminhoDaFoto('ws-1', 'p-1', 'e-1', 'image/png').split('/')[1];
    const b = caminhoDaFoto('ws-1', 'p-2', 'e-1', 'image/png').split('/')[1];
    expect(a).not.toBe(b);
  });

  it('recusa mime desconhecido', () => {
    expect(() => caminhoDaFoto('ws', 'p', 'e', 'application/pdf')).toThrow(/não aceito/);
  });

  it('aceita os formatos que celular produz', () => {
    // HEIC é o padrão do iPhone. Sem ele, metade dos pacientes não conseguiria
    // enviar foto nenhuma.
    for (const m of ['image/jpeg', 'image/png', 'image/webp', 'image/heic']) {
      expect(TIPOS_ACEITOS).toContain(m);
    }
  });

  it('assinatura de leitura é mais curta que a de envio', () => {
    // URL de leitura funciona para qualquer um que a receba; colada num grupo,
    // vira acesso à foto do paciente.
    expect(VALIDADE_DOWNLOAD_S).toBeLessThan(VALIDADE_UPLOAD_S);
  });
});

describe('token do diário', () => {
  it('não se repete e é seguro para URL', () => {
    const t = new Set(Array.from({ length: 200 }, () => gerarToken()));
    expect(t.size).toBe(200);
    for (const x of t) expect(x).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
