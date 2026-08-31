import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Formatos que o Gemini aceita como inlineData de áudio. */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
  'audio/flac',
];

/**
 * Teto do payload base64. O Gemini aceita até 20 MB por request inline;
 * 18 MB deixa margem para o restante do corpo e para o overhead do base64.
 */
const MAX_AUDIO_BASE64_CHARS = 18 * 1024 * 1024;

export class AudioIntakeDto {
  @IsString()
  @IsNotEmpty({ message: 'Áudio não recebido.' })
  @MaxLength(MAX_AUDIO_BASE64_CHARS, {
    message: 'Gravação muito longa. Grave a consulta em blocos menores.',
  })
  audioBase64!: string;

  @IsString()
  @IsIn(ALLOWED_AUDIO_MIME_TYPES, { message: 'Formato de áudio não suportado.' })
  mimeType!: string;
}
