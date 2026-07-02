import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PatientsService } from './patients.service';
import { Patient } from './patient.entity';
import { AuditService } from '../audit/audit.service';

// Chave AES-256 de teste (32 bytes em hex)
const TEST_KEY = randomBytes(32).toString('hex');

describe('PatientsService', () => {
  let service: PatientsService;
  let auditLog: jest.Mock;

  const mockPatientRepo = {
    create: jest.fn().mockImplementation((d) => d),
    save: jest.fn().mockImplementation((d) => ({ ...d, id: 'pat-1', createdAt: new Date(), isActive: true })),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    auditLog = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: mockPatientRepo },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(TEST_KEY) } },
        { provide: AuditService, useValue: { log: auditLog } },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
    auditLog.mockResolvedValue(undefined);
  });

  // ── Criptografia AES-256-CBC: round-trip ────────────────────────────────────
  describe('encrypt/decrypt (LGPD)', () => {
    it('deve criptografar e descriptografar mantendo o valor original', () => {
      const original = 'Maria da Silva Santos';
      const encrypted = (service as any).encrypt(original);
      expect(Buffer.isBuffer(encrypted)).toBe(true);
      expect(encrypted.toString('utf8')).not.toContain(original); // não está em texto plano
      const decrypted = (service as any).decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('deve gerar ciphertexts diferentes para o mesmo input (IV aleatório)', () => {
      const a = (service as any).encrypt('teste');
      const b = (service as any).encrypt('teste');
      expect(a.equals(b)).toBe(false); // IVs diferentes → ciphertexts diferentes
      expect((service as any).decrypt(a)).toBe('teste');
      expect((service as any).decrypt(b)).toBe('teste');
    });
  });

  // ── Hash de CPF (não reversível) ────────────────────────────────────────────
  describe('hashCpf', () => {
    it('deve gerar hash determinístico e normalizar formatação', () => {
      const h1 = (service as any).hashCpf('123.456.789-09');
      const h2 = (service as any).hashCpf('12345678909');
      expect(h1).toBe(h2); // mesma base normalizada → mesmo hash
      expect(h1).toHaveLength(64); // SHA-256 hex
      expect(h1).not.toContain('123'); // não reversível
    });
  });

  // ── create: criptografa e gera audit log ───────────────────────────────────
  describe('create', () => {
    it('deve criptografar o nome, salvar e registrar audit log de CREATE', async () => {
      const result = await service.create(
        {
          workspaceId: 'ws-1',
          createdBy: 'user-1',
          name: 'João Teste',
          birthDate: new Date('1990-05-15'),
          gender: 'male',
          lgpdConsentIp: '10.0.0.1',
        },
        'user-1',
        '10.0.0.1',
      );

      const savedArg = mockPatientRepo.save.mock.calls[0][0];
      expect(Buffer.isBuffer(savedArg.nameEncrypted)).toBe(true);
      expect((service as any).decrypt(savedArg.nameEncrypted)).toBe('João Teste');
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', resource: 'patients' }),
      );
      expect(result.name).toBe('João Teste');
    });

    it('persiste medications e clinicalConditions quando fornecidos', async () => {
      await service.create(
        {
          workspaceId: 'ws-1',
          createdBy: 'user-1',
          name: 'Com Contexto',
          birthDate: new Date('1990-01-01'),
          gender: 'female',
          lgpdConsentIp: '10.0.0.1',
          medications: [{ name: 'Omeprazol', dose: '20mg' }],
          clinicalConditions: ['Hipertensão'],
        },
        'user-1',
        '10.0.0.1',
      );
      const savedArg = mockPatientRepo.save.mock.calls[0][0];
      expect(savedArg.medications).toEqual([{ name: 'Omeprazol', dose: '20mg' }]);
      expect(savedArg.clinicalConditions).toEqual(['Hipertensão']);
    });

    it('usa arrays vazios quando contexto clínico é omitido', async () => {
      await service.create(
        { workspaceId: 'ws-1', createdBy: 'user-1', name: 'Sem Contexto', birthDate: new Date('1990-01-01'), gender: 'male', lgpdConsentIp: '10.0.0.1' },
        'user-1',
        '10.0.0.1',
      );
      const savedArg = mockPatientRepo.save.mock.calls[0][0];
      expect(savedArg.medications).toEqual([]);
      expect(savedArg.clinicalConditions).toEqual([]);
    });
  });

  describe('updateClinicalContext', () => {
    it('atualiza medications/condições e registra audit log de UPDATE', async () => {
      const nameEnc = (service as any).encrypt('Paciente X');
      const existing = { id: 'pat-1', workspaceId: 'ws-1', nameEncrypted: nameEnc, birthDate: new Date('1990-01-01'), gender: 'male', isActive: true };
      mockPatientRepo.findOne
        .mockResolvedValueOnce(existing) // verificação de existência
        .mockResolvedValueOnce({ ...existing, medications: [{ name: 'Metformina' }], clinicalConditions: ['Diabetes'] }); // re-fetch

      const result = await service.updateClinicalContext('pat-1', 'ws-1', 'user-1', '10.0.0.1', {
        medications: [{ name: 'Metformina' }],
        clinicalConditions: ['Diabetes'],
      });

      expect(mockPatientRepo.update).toHaveBeenCalledWith(
        { id: 'pat-1', workspaceId: 'ws-1' },
        { medications: [{ name: 'Metformina' }], clinicalConditions: ['Diabetes'] },
      );
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE', resource: 'patients', resourceId: 'pat-1' }),
      );
      expect(result.medications).toEqual([{ name: 'Metformina' }]);
      expect(result.clinicalConditions).toEqual(['Diabetes']);
    });

    it('atualiza apenas o campo fornecido (não inclui o ausente no update)', async () => {
      const nameEnc = (service as any).encrypt('Y');
      const existing = { id: 'pat-2', workspaceId: 'ws-1', nameEncrypted: nameEnc, birthDate: new Date('1990-01-01'), gender: 'male', isActive: true };
      mockPatientRepo.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing);

      await service.updateClinicalContext('pat-2', 'ws-1', 'user-1', '10.0.0.1', { clinicalConditions: ['Asma'] });

      const changesArg = mockPatientRepo.update.mock.calls[0][1];
      expect(changesArg).toEqual({ clinicalConditions: ['Asma'] });
      expect(changesArg.medications).toBeUndefined();
    });

    it('lança NotFoundException quando o paciente não existe', async () => {
      mockPatientRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.updateClinicalContext('x', 'ws-1', 'user-1', '10.0.0.1', { clinicalConditions: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findById: gera audit log de READ ────────────────────────────────────────
  describe('findById', () => {
    it('deve descriptografar e registrar audit log de READ', async () => {
      const nameEnc = (service as any).encrypt('Ana Paula');
      mockPatientRepo.findOne.mockResolvedValueOnce({
        id: 'pat-1',
        workspaceId: 'ws-1',
        nameEncrypted: nameEnc,
        emailEncrypted: null,
        birthDate: new Date('1985-01-01'),
        gender: 'female',
        isActive: true,
      });

      const result = await service.findById('pat-1', 'user-1', 'ws-1', '10.0.0.1');
      expect(result.name).toBe('Ana Paula');
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'READ', resource: 'patients', resourceId: 'pat-1' }),
      );
    });

    it('deve lançar NotFoundException quando paciente não existe', async () => {
      mockPatientRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.findById('inexistente', 'user-1', 'ws-1', '10.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── listByWorkspace: paginação + audit log ──────────────────────────────────
  describe('listByWorkspace', () => {
    it('deve paginar e registrar audit log de READ na lista', async () => {
      const nameEnc = (service as any).encrypt('Carlos');
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [{ id: 'pat-1', nameEncrypted: nameEnc, birthDate: new Date('1990-01-01'), gender: 'male', isActive: true }],
          1,
        ]),
      };
      mockPatientRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.listByWorkspace('ws-1', {
        page: 1,
        limit: 20,
        requestingUserId: 'user-1',
        requestingIp: '10.0.0.1',
      });

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Carlos');
      expect(result.pages).toBe(1);
      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'READ', resource: 'patients' }),
      );
    });

    it('deve limitar o page size máximo a 100', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockPatientRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.listByWorkspace('ws-1', { limit: 9999 });
      expect(qb.take).toHaveBeenCalledWith(100); // clamp em 100
    });
  });

  // ── anonymize: LGPD direito ao esquecimento ─────────────────────────────────
  describe('anonymize', () => {
    it('deve substituir dados pessoais por placeholder e desativar', async () => {
      await service.anonymize('pat-1', 'ws-1');
      const updateArg = mockPatientRepo.update.mock.calls[0][1];
      expect((service as any).decrypt(updateArg.nameEncrypted)).toBe('[ANONIMIZADO]');
      expect(updateArg.emailEncrypted).toBeNull();
      expect(updateArg.cpfHash).toBeNull();
      expect(updateArg.isActive).toBe(false);
    });
  });
});
