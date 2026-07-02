import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Patient } from '../patients/patient.entity';
import { ClinicalAlert } from '../alerts/clinical-alert.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { TokenTransaction } from '../tokens/token-transaction.entity';

describe('DashboardService', () => {
  let service: DashboardService;

  // Query builder usado pelo alertRepo (COUNT DISTINCT e lista de pendentes)
  const makeAlertQb = () => ({
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ count: '3' }),
    getRawMany: jest.fn().mockResolvedValue([
      {
        id: 'al-1',
        severity: 'critical',
        title: 'Interação crítica',
        description: 'desc',
        created_at: new Date('2026-06-10'),
        patient_code: 'PAC-001',
      },
    ]),
  });

  const mockPatientRepo = { count: jest.fn() };
  const mockAlertRepo = { count: jest.fn(), createQueryBuilder: jest.fn(() => makeAlertQb()) };
  const mockWorkspaceRepo = { findOne: jest.fn() };
  const mockTxRepo = { count: jest.fn(), find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    // patientRepo.count: 1ª chamada = total, 2ª = ativos
    mockPatientRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
    // alertRepo.count: 1ª = pendentes, 2ª = críticos
    mockAlertRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
    // txRepo.count = relatórios gerados
    mockTxRepo.count.mockResolvedValue(7);
    mockTxRepo.find.mockResolvedValue([
      { operation: 'consumption', module: 'report_generation', amount: -5, description: 'Relatório', createdAt: new Date('2026-06-12') },
    ]);
    mockWorkspaceRepo.findOne.mockResolvedValue({ plan: 'clinic', tokenBalance: 500, tokenReserved: 20 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Patient), useValue: mockPatientRepo },
        { provide: getRepositoryToken(ClinicalAlert), useValue: mockAlertRepo },
        { provide: getRepositoryToken(Workspace), useValue: mockWorkspaceRepo },
        { provide: getRepositoryToken(TokenTransaction), useValue: mockTxRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('agrega contagens de pacientes (total/ativos/com-alertas)', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.patients.total).toBe(10);
    expect(stats.patients.active).toBe(8);
    expect(stats.patients.withAlerts).toBe(3); // do COUNT DISTINCT
  });

  it('agrega alertas pendentes e críticos', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.alerts.pending).toBe(5);
    expect(stats.alerts.critical).toBe(1);
  });

  it('conta relatórios gerados a partir das transações de tokens', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.reports.total).toBe(7);
    expect(mockTxRepo.count).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', module: 'report_generation' },
    });
  });

  it('expõe saldo e plano do workspace', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.workspace.plan).toBe('clinic');
    expect(stats.workspace.tokenBalance).toBe(500);
    expect(stats.workspace.tokenReserved).toBe(20);
  });

  it('mapeia a lista dos alertas pendentes com código do paciente', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.pendingAlerts).toHaveLength(1);
    expect(stats.pendingAlerts[0]).toEqual(
      expect.objectContaining({ id: 'al-1', severity: 'critical', patientCode: 'PAC-001' }),
    );
  });

  it('mapeia a atividade recente das transações', async () => {
    const stats = await service.getStats('ws-1');
    expect(stats.recentActivity).toHaveLength(1);
    expect(stats.recentActivity[0].module).toBe('report_generation');
  });

  it('usa defaults seguros quando o workspace não é encontrado', async () => {
    mockWorkspaceRepo.findOne.mockResolvedValueOnce(null);
    const stats = await service.getStats('ws-x');
    expect(stats.workspace.plan).toBe('free_trial');
    expect(stats.workspace.tokenBalance).toBe(0);
  });
});
