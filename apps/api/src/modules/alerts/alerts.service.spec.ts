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
