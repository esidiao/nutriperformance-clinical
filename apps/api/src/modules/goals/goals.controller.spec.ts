import { GoalsController } from './goals.controller';

describe('GoalsController', () => {
  let controller: GoalsController;
  let svc: any;
  const req = { user: { sub: 'user-sub', id: 'user-id', workspaceId: 'ws-1' } };

  beforeEach(() => {
    svc = {
      create: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      findByPatient: jest.fn().mockResolvedValue([]),
      getSummary: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      update: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      addCheckpoint: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      markAchieved: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    controller = new GoalsController(svc);
  });

  it('create delega com workspaceId e req.user.sub', () => {
    const dto = { goalType: 'hypertrophy' };
    controller.create(req, dto as any);
    expect(svc.create).toHaveBeenCalledWith('ws-1', 'user-sub', dto);
  });

  it('addCheckpoint extrai value e note do DTO validado', () => {
    controller.addCheckpoint(req, 'goal-1', { value: 72.5, note: 'pesagem' } as any);
    expect(svc.addCheckpoint).toHaveBeenCalledWith('ws-1', 'goal-1', 'user-sub', 72.5, 'pesagem');
  });

  it('addCheckpoint funciona sem note', () => {
    controller.addCheckpoint(req, 'goal-1', { value: 70 } as any);
    expect(svc.addCheckpoint).toHaveBeenCalledWith('ws-1', 'goal-1', 'user-sub', 70, undefined);
  });

  it('markAchieved e delete delegam com workspace/id/sub', () => {
    controller.markAchieved(req, 'goal-1');
    controller.delete(req, 'goal-1');
    expect(svc.markAchieved).toHaveBeenCalledWith('ws-1', 'goal-1', 'user-sub');
    expect(svc.delete).toHaveBeenCalledWith('ws-1', 'goal-1', 'user-sub');
  });
});
