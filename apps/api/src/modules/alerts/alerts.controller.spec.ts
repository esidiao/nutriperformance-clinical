import { AlertsController } from './alerts.controller';

describe('AlertsController', () => {
  let controller: AlertsController;
  let svc: any;
  const req = { user: { id: 'user-1', workspaceId: 'ws-1' } };

  beforeEach(() => {
    svc = {
      getPatientAlerts: jest.fn().mockResolvedValue([]),
      resolveAlert: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AlertsController(svc);
  });

  it('getAlerts coage includeResolved="true" para boolean true', async () => {
    await controller.getAlerts('pat-1', req, 'true' as any);
    expect(svc.getPatientAlerts).toHaveBeenCalledWith('ws-1', 'pat-1', true);
  });

  it('getAlerts trata default (sem query) como false', async () => {
    await controller.getAlerts('pat-1', req);
    expect(svc.getPatientAlerts).toHaveBeenCalledWith('ws-1', 'pat-1', false);
  });

  it('getAlerts sempre escopa pelo workspace do token, nunca por parâmetro do cliente', async () => {
    await controller.getAlerts('pat-de-outro-workspace', req);
    expect(svc.getPatientAlerts).toHaveBeenCalledWith('ws-1', 'pat-de-outro-workspace', false);
  });

  it('resolve repassa dto.notes (corrigido: antes lia note e perdia o dado)', async () => {
    await controller.resolve('al-1', { notes: 'Conduta ajustada' }, req);
    expect(svc.resolveAlert).toHaveBeenCalledWith('ws-1', 'al-1', 'user-1', 'Conduta ajustada');
  });

  it('resolve funciona sem notes', async () => {
    const res = await controller.resolve('al-1', {}, req);
    expect(svc.resolveAlert).toHaveBeenCalledWith('ws-1', 'al-1', 'user-1', undefined);
    expect(res).toEqual({ resolved: true, alertId: 'al-1' });
  });
});
