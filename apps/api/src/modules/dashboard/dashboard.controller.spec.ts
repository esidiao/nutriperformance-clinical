import { DashboardController } from './dashboard.controller';

describe('DashboardController', () => {
  let controller: DashboardController;
  let svc: any;

  beforeEach(() => {
    svc = { getStats: jest.fn().mockResolvedValue({ patients: { total: 0 } }) };
    controller = new DashboardController(svc);
  });

  it('stats delega para getStats com o workspaceId do usuário autenticado', async () => {
    await controller.stats({ user: { workspaceId: 'ws-42' } });
    expect(svc.getStats).toHaveBeenCalledWith('ws-42');
  });
});
