-- =============================================================
-- Telessaúde — lacuna 13 do benchmark competitivo
--
-- O QUE É: integração do FLUXO. A consulta online ganha uma sala, e o sistema
-- entrega o link à pessoa certa no momento certo.
--
-- O QUE NÃO É: vídeo nativo. WebRTC com servidores TURN é um produto à parte e
-- não roda em instância de plano gratuito. O vídeo vem de fora.
--
-- Idempotente.
-- =============================================================

ALTER TABLE appointments
  -- URL completa da sala. Nulo em consulta presencial ou sem sala definida.
  ADD COLUMN IF NOT EXISTS link_video TEXT,
  -- gerado | proprio. Importa para a tela: sala gerada usa serviço público de
  -- terceiro, e a profissional precisa saber disso antes de usar.
  ADD COLUMN IF NOT EXISTS video_origem TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_video_origem_check'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_video_origem_check CHECK (
        video_origem IS NULL OR video_origem IN ('gerado', 'proprio')
      );
  END IF;
END $$;
