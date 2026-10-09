import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoalsService } from './goals.service';
import { PatientGoal } from './patient-goal.entity';
import { AuditService } from '../audit/audit.service';
import { PatientsService } from '../patients/patients.service';

/**
 * Lista de metas do workspace com o paciente identificado.
 *
 * O relatório de testes de 07/10/2026 descreveu "metas de todos os pacientes
 * misturadas". Não era mistura de dado real: a tela mostrava três exemplos
 * escritos no código. Mas a leitura apontou o requisito certo — uma lista de
 * metas sem o nome do paciente em cada linha não serve para nada.
 */
const WS = 'ws-1';
const USER = 'user-1';

const meta = (over: Partial<PatientGoal> = {}): any => ({
  id: 'g-1', workspaceId: WS, patientId: 'p-1', createdBy: USER,
  goalType: 'hypertrophy', description: 'Aumentar massa muscular',
  isAchieved: false, checkpoints: [], createdAt: new Date(), ...over,
});

describe('GoalsService.listarDoWorkspace', () => {
  let svc: GoalsService;
  let repo: any;
  let patients: any;

  beforeEach(async () => {
    repo = { find: jest.fn(async () => []) };
    patients = { nomesPorId: jest.fn(async () => new Map()) };

    const mod = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: getRepositoryToken(PatientGoal), useValue: repo },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PatientsService, useValue: patients },
      ],
    }).compile();
    svc = mod.get(GoalsService);
  });

  it('anexa nome e código do paciente a cada meta', async () => {
    repo.find.mockResolvedValue([meta({ patientId: 'p-1' }), meta({ id: 'g-2', patientId: 'p-2' })]);
    patients.nomesPorId.mockResolvedValue(new Map([
      ['p-1', { nome: 'Ana Souza', codigo: 'PAC-001' }],
      ['p-2', { nome: 'Bruno Lima', codigo: 'PAC-002' }],
    ]));

    const r = await svc.listarDoWorkspace(WS, USER);
    expect(r[0].paciente).toEqual({ nome: 'Ana Souza', codigo: 'PAC-001' });
    expect(r[1].paciente).toEqual({ nome: 'Bruno Lima', codigo: 'PAC-002' });
  });

  it('pede os nomes UMA vez, não um por meta', async () => {
    // Cada resolução descriptografa e grava audit log. Chamar por linha
    // multiplicaria os dois sem necessidade.
    repo.find.mockResolvedValue([
      meta({ id: 'g-1', patientId: 'p-1' }),
      meta({ id: 'g-2', patientId: 'p-1' }),
      meta({ id: 'g-3', patientId: 'p-2' }),
    ]);
    await svc.listarDoWorkspace(WS, USER);
    expect(patients.nomesPorId).toHaveBeenCalledTimes(1);
  });

  it('meta de paciente não resolvido fica com paciente null, não some', async () => {
    // Sumir da tela seria perder o registro sem avisar ninguém.
    repo.find.mockResolvedValue([meta({ patientId: 'p-fantasma' })]);
    patients.nomesPorId.mockResolvedValue(new Map());

    const r = await svc.listarDoWorkspace(WS, USER);
    expect(r).toHaveLength(1);
    expect(r[0].paciente).toBeNull();
  });

  it('por padrão esconde as concluídas', async () => {
    await svc.listarDoWorkspace(WS, USER);
    expect(repo.find.mock.calls[0][0].where).toMatchObject({ isAchieved: false });
  });

  it('com concluidas=true não filtra por isAchieved', async () => {
    await svc.listarDoWorkspace(WS, USER, { incluirConcluidas: true });
    expect(repo.find.mock.calls[0][0].where).not.toHaveProperty('isAchieved');
  });

  it('o filtro por paciente entra na consulta', async () => {
    await svc.listarDoWorkspace(WS, USER, { patientId: 'p-9' });
    expect(repo.find.mock.calls[0][0].where).toMatchObject({ patientId: 'p-9' });
  });

  it('SEMPRE filtra por workspace', async () => {
    // Sem isto a tela mostraria meta de outra clínica — aí sim seria a mistura
    // que o relatório descreveu.
    await svc.listarDoWorkspace(WS, USER, { patientId: 'p-9' });
    expect(repo.find.mock.calls[0][0].where).toMatchObject({ workspaceId: WS });
  });

  it('resolve nomes no escopo do workspace, não globalmente', async () => {
    repo.find.mockResolvedValue([meta()]);
    await svc.listarDoWorkspace(WS, USER);
    expect(patients.nomesPorId).toHaveBeenCalledWith(WS, expect.any(Array), USER);
  });
});
