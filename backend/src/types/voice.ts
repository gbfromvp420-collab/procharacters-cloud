/**
 * Voice generation types — ElevenLabs integration.
 *
 * Provides character voice synthesis so AI characters can speak
 * during live sessions. Each character can have a unique voice ID.
 */

export interface VoiceConfig {
  /** ElevenLabs API key. */
  apiKey: string;
  /** Base URL (default: https://api.elevenlabs.io/v1). */
  baseUrl: string;
  /** Default voice ID used when character has no specific voice. */
  defaultVoiceId?: string;
  /** Model to use for TTS. */
  modelId: string;
  /** Voice settings. */
  stability: number;
  similarityBoost: number;
  style: number;
  /** Audio output format (mp3_44100_128, pcm_16000, etc.). */
  outputFormat: string;
}

export interface VoiceGenerateRequest {
  /** Text to convert to speech. */
  text: string;
  /** ElevenLabs voice ID (overrides default). */
  voiceId?: string;
  /** Character ID for logging/tracking. */
  characterId: string;
  /** Session ID for tracking. */
  sessionId: string;
  /** Optional emotion hint to adjust voice delivery. */
  emotion?: string;
}

export interface VoiceGenerateResult {
  /** URL or base64 data of generated audio. */
  audioUrl: string;
  /** Audio format. */
  format: string;
  /** Duration in seconds (estimated). */
  durationSeconds?: number;
  /** Character count billed. */
  characterCount: number;
}

export interface VoiceInfo {
  voiceId: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  previewUrl?: string;
}
