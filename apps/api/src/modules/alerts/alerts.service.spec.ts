import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { ClinicalAlert } from './clinical-alert.entity';

describe('AlertsService — alert rules engine', () => {
  let service: AlertsService;

  const mockRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'alert-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(ClinicalAlert), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    jest.clearAllMocks();
  });

  it('fires critical alert for thermogenic + arrhythmia', async () => {
    const alerts = await service.evaluateAndCreateAlerts({
      patientId: 'p-1',
      workspaceId: 'ws-1',
      context: {
        supplements: [{ name: 'Termogênico com cafeína' }],
        medications: [],
        clinicalConditions: ['Arritmia cardíaca'],
      },
    });
    expect(alerts.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('fires danger alert for vitamin K + anticoagulant', async () => {
    const alerts = await service.evaluateAndCreateAlerts({
      patientId: 'p-1',
      workspaceId: 'ws-1',
      context: {
        supplements: [{ name: 'Vitamina K2' }],
        medications: [{ name: 'Varfarina' }],
        clinicalConditions: [],
      },
    });
    expect(alerts.some((a) => a.severity === 'danger')).toBe(true);
  });

  it('fires danger alert for very low BMI', async () => {
    const alerts = await service.evaluateAndCreateAlerts({
      patientId: 'p-1',
      workspaceId: 'ws-1',
      context: {
        supplements: [],
        medications: [],
        clinicalConditions: [],
        physicalData: { bmi: 15.5 },
        patientAge: 25,
      },
    });
    expect(alerts.some((a) => a.severity === 'danger')).toBe(true);
  });

  it('fires warning for low caloric intake', async () => {
    const alerts = await service.evaluateAndCreateAlerts({
      patientId: 'p-1',
      workspaceId: 'ws-1',
      context: {
        supplements: [],
        medications: [],
        clinicalConditions: [],
        nutritionalData: { caloricTarget: 900, totalEnergyExpenditure: 2000 },
      },
    });
    expect(alerts.some((a) => a.category === 'nutrition')).toBe(true);
  });

  it('returns no alerts when context is benign', async () => {
    const alerts = await service.evaluateAndCreateAlerts({
      patientId: 'p-1',
      workspaceId: 'ws-1',
      context: {
        supplements: [{ name: 'Whey protein' }],
        medications: [],
        clinicalConditions: [],
        physicalData: { bmi: 24.0 },
        patientAge: 30,
      },
    });
    expect(alerts).toHaveLength(0);
  });
});

/**
 * Isolamento por workspace. O alerta clínico é gravado com workspace_id, mas a
 * leitura e a resolução ignoravam esse campo: bastava o UUID do paciente (ou do
 * alerta) para ler/alterar dado clínico de outro workspace.
 */
describe('AlertsService — isolamento por workspace', () => {
  let service: AlertsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'alert-1', ...d })),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertsService, { provide: getRepositoryToken(ClinicalAlert), useValue: repo }],
    }).compile();
    service = module.get<AlertsService>(AlertsService);
  });

  it('getPatientAlerts filtra por workspaceId além de patientId', async () => {
    await service.getPatientAlerts('ws-1', 'pat-1');
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'ws-1', patientId: 'pat-1', isResolved: false }),
      }),
    );
  });

  it('includeResolved não descarta o filtro de workspace', async () => {
    await service.getPatientAlerts('ws-1', 'pat-1', true);
    const arg = repo.find.mock.calls[0][0];
    expect(arg.where.workspaceId).toBe('ws-1');
    expect(arg.where.isResolved).toBeUndefined();
  });

  it('aplica teto de paginação e ignora limit não numérico', async () => {
    await service.getPatientAlerts('ws-1', 'pat-1', false, 99999);
    expect(repo.find.mock.calls[0][0].take).toBe(500);

    await service.getPatientAlerts('ws-1', 'pat-1', false, NaN);
    expect(repo.find.mock.calls[1][0].take).toBe(200);
  });

  it('resolveAlert restringe o UPDATE ao workspace do usuário', async () => {
    await service.resolveAlert('ws-1', 'al-1', 'user-1', 'Conduta ajustada');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'al-1', workspaceId: 'ws-1' },
      expect.objectContaining({ isResolved: true, resolvedBy: 'user-1', resolutionNote: 'Conduta ajustada' }),
    );
  });

  it('resolveAlert devolve 404 quando o alerta é de outro workspace (nenhuma linha afetada)', async () => {
    repo.update.mockResolvedValue({ affected: 0 });
    await expect(service.resolveAlert('ws-1', 'al-de-outro-ws', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
