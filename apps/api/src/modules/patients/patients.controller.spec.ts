import { PatientsController } from './patients.controller';

describe('PatientsController', () => {
  let controller: PatientsController;
  let service: any;

  const req = { user: { id: 'user-1', workspaceId: 'ws-1' } };
  const ip = '10.0.0.1';

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'pat-1' }),
      listByWorkspace: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findById: jest.fn().mockResolvedValue({ id: 'pat-1' }),
      updateClinicalContext: jest.fn().mockResolvedValue({ id: 'pat-1' }),
      requestDeletion: jest.fn().mockResolvedValue(undefined),
    };
    controller = new PatientsController(service);
  });

  describe('create', () => {
    it('rejeita cadastro sem consentimento LGPD e não chama o service', async () => {
      const res: any = await controller.create(
        { name: 'X', birthDate: '1990-01-01', gender: 'male', lgpdConsent: false } as any,
        req,
        ip,
      );
      expect(res.error).toMatch(/LGPD/i);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('cria paciente com consentimento, convertendo birthDate e injetando contexto da requisição', async () => {
      await controller.create(
        {
          name: 'Maria', birthDate: '1990-05-15', gender: 'female', lgpdConsent: true,
          medications: [{ name: 'Omeprazol', dose: '20mg' }], clinicalConditions: ['Hipertensão'],
        } as any,
        req,
        ip,
      );
      expect(service.create).toHaveBeenCalledTimes(1);
      const arg = service.create.mock.calls[0][0];
      expect(arg.workspaceId).toBe('ws-1');
      expect(arg.createdBy).toBe('user-1');
      expect(arg.lgpdConsentIp).toBe('10.0.0.1');
      expect(arg.birthDate).toBeInstanceOf(Date);
      expect(arg.medications).toEqual([{ name: 'Omeprazol', dose: '20mg' }]);
      expect(arg.clinicalConditions).toEqual(['Hipertensão']);
    });
  });

  describe('list', () => {
    it('converte query params (page/limit/active) e repassa contexto de auditoria', async () => {
      await controller.list(req, ip, '2', '50', 'PAC', 'true');
      expect(service.listByWorkspace).toHaveBeenCalledWith('ws-1', {
        page: 2,
        limit: 50,
        code: 'PAC',
        active: true,
        requestingUserId: 'user-1',
        requestingIp: '10.0.0.1',
      });
    });

    it('trata active=false e ausência de filtros', async () => {
      await controller.list(req, ip, undefined, undefined, undefined, 'false');
      const arg = service.listByWorkspace.mock.calls[0][1];
      expect(arg.active).toBe(false);
      expect(arg.page).toBeUndefined();
      expect(arg.code).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('delega para findById com id, usuário, workspace e ip', async () => {
      await controller.findOne('pat-1', req, ip);
      expect(service.findById).toHaveBeenCalledWith('pat-1', 'user-1', 'ws-1', '10.0.0.1');
    });
  });

  describe('update', () => {
    it('delega para updateClinicalContext', async () => {
      const dto = { clinicalConditions: ['Diabetes'] };
      await controller.update('pat-1', dto as any, req, ip);
      expect(service.updateClinicalContext).toHaveBeenCalledWith('pat-1', 'ws-1', 'user-1', '10.0.0.1', dto);
    });
  });
});
