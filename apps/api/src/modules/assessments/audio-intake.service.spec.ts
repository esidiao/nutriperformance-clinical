import { BadRequestException } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { AudioIntakeDto } from './dto/audio-intake.dto';

const COST = 15;

function build(overrides: {
  available?: number;
  transcribe?: jest.Mock;
} = {}) {
  const tokenService = {
    getBalance: jest.fn().mockResolvedValue({
      balance: overrides.available ?? 100,
      reserved: 0,
      available: overrides.available ?? 100,
    }),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  const aiEngine = {
    transcribeAudioIntake:
      overrides.transcribe ??
      jest.fn().mockResolvedValue({
        transcricao: 'Paciente relata queixa de fadiga.',
        campos: { mainComplaint: 'fadiga', weight: 72 },
        observacoes: '',
      }),
  };

  const auditService = { log: jest.fn() };

  const service = new AssessmentsService(
    {} as any,
    {} as any,
    aiEngine as any,
    tokenService as any,
    auditService as any,
  );

  return { service, tokenService, aiEngine, auditService };
}

const dto: AudioIntakeDto = { audioBase64: 'AAAA', mimeType: 'audio/webm' };

describe('AssessmentsService.transcribeAudioIntake', () => {
  it('transcreve, debita tokens e registra auditoria', async () => {
    const { service, tokenService, aiEngine, auditService } = build();

    const result = await service.transcribeAudioIntake('ws-1', 'user-1', 'nutritional', dto);

    expect(aiEngine.transcribeAudioIntake).toHaveBeenCalledWith('AAAA', 'audio/webm', 'nutritional');
    expect(result.campos).toEqual({ mainComplaint: 'fadiga', weight: 72 });
    expect(result.tokensConsumed).toBe(COST);
    expect(tokenService.consume).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', operation: 'nutritional_audio_intake', cost: COST }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'nutritional_audio_intake' }),
    );
  });

  it('usa a operação de token correspondente ao tipo físico', async () => {
    const { service, tokenService, aiEngine } = build();

    await service.transcribeAudioIntake('ws-1', 'user-1', 'physical', dto);

    expect(aiEngine.transcribeAudioIntake).toHaveBeenCalledWith('AAAA', 'audio/webm', 'physical');
    expect(tokenService.consume).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'physical_audio_intake' }),
    );
  });

  it('recusa e NÃO chama o Gemini quando o saldo é insuficiente', async () => {
    const { service, aiEngine, tokenService } = build({ available: 5 });

    await expect(
      service.transcribeAudioIntake('ws-1', 'user-1', 'nutritional', dto),
    ).rejects.toThrow(BadRequestException);

    // O portão existe justamente para não pagar a chamada ao Gemini sem saldo.
    expect(aiEngine.transcribeAudioIntake).not.toHaveBeenCalled();
    expect(tokenService.consume).not.toHaveBeenCalled();
  });

  it('não debita tokens quando a transcrição falha', async () => {
    const transcribe = jest.fn().mockRejectedValue(new Error('Gemini fora do ar'));
    const { service, tokenService } = build({ transcribe });

    await expect(
      service.transcribeAudioIntake('ws-1', 'user-1', 'nutritional', dto),
    ).rejects.toThrow('Gemini fora do ar');

    expect(tokenService.consume).not.toHaveBeenCalled();
  });
});
