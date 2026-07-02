import { LaboratoryController } from './laboratory.controller';

describe('LaboratoryController', () => {
  let controller: LaboratoryController;
  let svc: any;
  const req = { user: { sub: 'user-sub', id: 'user-id', workspaceId: 'ws-1' } };

  beforeEach(() => {
    svc = {
      create: jest.fn().mockResolvedValue({ id: 'exam-1' }),
      findByPatient: jest.fn().mockResolvedValue([]),
      getLatest: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue({ id: 'exam-1' }),
      update: jest.fn().mockResolvedValue({ id: 'exam-1' }),
      analyzeWithAi: jest.fn().mockResolvedValue({ analysis: {}, tokensConsumed: 10 }),
    };
    controller = new LaboratoryController(svc);
  });

  it('create delega com workspaceId e req.user.sub', () => {
    const dto = { collectionDate: '2026-01-01', hemoglobinGDl: 14 };
    controller.create(req, dto as any);
    expect(svc.create).toHaveBeenCalledWith('ws-1', 'user-sub', dto);
  });

  it('findByPatient delega com workspace e patientId', () => {
    controller.findByPatient(req, 'pat-1');
    expect(svc.findByPatient).toHaveBeenCalledWith('ws-1', 'pat-1');
  });

  it('findOne delega com workspace, id e sub', () => {
    controller.findOne(req, 'exam-1');
    expect(svc.findOne).toHaveBeenCalledWith('ws-1', 'exam-1', 'user-sub');
  });

  it('update delega com workspace, id, sub e dto', () => {
    const dto = { professionalInterpretation: 'nota' };
    controller.update(req, 'exam-1', dto as any);
    expect(svc.update).toHaveBeenCalledWith('ws-1', 'exam-1', 'user-sub', dto);
  });

  it('analyze repassa o supplementContext', () => {
    controller.analyze(req, 'exam-1', ['Creatina']);
    expect(svc.analyzeWithAi).toHaveBeenCalledWith('ws-1', 'exam-1', 'user-sub', ['Creatina']);
  });
});
