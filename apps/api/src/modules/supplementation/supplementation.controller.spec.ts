import { SupplementationController } from './supplementation.controller';

describe('SupplementationController', () => {
  let controller: SupplementationController;
  let svc: any;
  const req = { user: { sub: 'user-sub', id: 'user-id', workspaceId: 'ws-1' } };

  beforeEach(() => {
    svc = {
      create: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      findByPatient: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      update: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      deactivate: jest.fn().mockResolvedValue({ id: 'sup-1' }),
      analyzeWithAi: jest.fn().mockResolvedValue({ analysis: {}, tokensConsumed: 8 }),
    };
    controller = new SupplementationController(svc);
  });

  it('create delega com workspaceId e req.user.sub', () => {
    const dto = { supplementName: 'Creatina' };
    controller.create(req, dto as any);
    expect(svc.create).toHaveBeenCalledWith('ws-1', 'user-sub', dto);
  });

  it('findByPatient delega com workspace e patientId', () => {
    controller.findByPatient(req, 'pat-1');
    expect(svc.findByPatient).toHaveBeenCalledWith('ws-1', 'pat-1');
  });

  it('findOne delega com workspace e id', () => {
    controller.findOne(req, 'sup-1');
    expect(svc.findOne).toHaveBeenCalledWith('ws-1', 'sup-1');
  });

  it('update delega com workspace, id, sub e dto', () => {
    const dto = { doseAmount: 5 };
    controller.update(req, 'sup-1', dto as any);
    expect(svc.update).toHaveBeenCalledWith('ws-1', 'sup-1', 'user-sub', dto);
  });

  it('deactivate delega com workspace, id e sub', () => {
    controller.deactivate(req, 'sup-1');
    expect(svc.deactivate).toHaveBeenCalledWith('ws-1', 'sup-1', 'user-sub');
  });

  it('analyze delega com workspace, patientId e sub', () => {
    controller.analyze(req, 'pat-1');
    expect(svc.analyzeWithAi).toHaveBeenCalledWith('ws-1', 'pat-1', 'user-sub');
  });
});
