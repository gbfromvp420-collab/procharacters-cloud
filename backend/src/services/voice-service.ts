/**
 * ElevenLabs voice service — generates character speech audio.
 *
 * Integrates with ElevenLabs TTS API to give each AI character
 * a unique, expressive voice during live sessions.
 *
 * Features:
 * - Per-character voice IDs (set in character model.json)
 * - Emotion-aware delivery (adjusts stability/style per turn)
 * - Streaming audio support for low-latency playback
 * - Fallback to silence if API is unavailable
 */

import type {
  VoiceConfig,
  VoiceGenerateRequest,
  VoiceGenerateResult,
  VoiceInfo,
} from "../types/voice.js";

export class VoiceService {
  private config: VoiceConfig;

  constructor(config: VoiceConfig) {
    this.config = config;
  }

  get isConfigured(): boolean {
    return !!this.config.apiKey && !!this.config.defaultVoiceId;
  }

  /**
   * Generate speech audio from text using ElevenLabs TTS.
   * Returns a URL to the audio file or base64 audio data.
   */
  async generateSpeech(request: VoiceGenerateRequest): Promise<VoiceGenerateResult> {
    if (!this.config.apiKey) {
      throw new VoiceServiceError("ElevenLabs API key not configured");
    }

    const voiceId = request.voiceId ?? this.config.defaultVoiceId;
    if (!voiceId) {
      throw new VoiceServiceError("No voice ID provided and no default voice configured");
    }

    // Adjust voice settings based on emotional context
    const settings = this.getEmotionAdjustedSettings(request.emotion);

    try {
      const response = await fetch(
        `${this.config.baseUrl}/text-to-speech/${voiceId}?output_format=${this.config.outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: request.text,
            model_id: this.config.modelId,
            voice_settings: {
              stability: settings.stability,
              similarity_boost: settings.similarityBoost,
              style: settings.style,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new VoiceServiceError(
          `ElevenLabs API error: ${response.status} ${response.statusText}${errorBody ? ` — ${errorBody}` : ""}`,
        );
      }

      // ElevenLabs returns raw audio bytes
      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");
      const mimeType = this.config.outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/pcm";

      return {
        audioUrl: `data:${mimeType};base64,${base64Audio}`,
        format: this.config.outputFormat,
        durationSeconds: this.estimateDuration(request.text),
        characterCount: request.text.length,
      };
    } catch (err) {
      if (err instanceof VoiceServiceError) throw err;
      throw new VoiceServiceError(`ElevenLabs generation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Stream speech audio for lower latency playback.
   * Returns a ReadableStream of audio chunks.
   */
  async generateSpeechStream(request: VoiceGenerateRequest): Promise<ReadableStream<Uint8Array> | null> {
    if (!this.config.apiKey) {
      throw new VoiceServiceError("ElevenLabs API key not configured");
    }

    const voiceId = request.voiceId ?? this.config.defaultVoiceId;
    if (!voiceId) {
      throw new VoiceServiceError("No voice ID provided and no default voice configured");
    }

    const settings = this.getEmotionAdjustedSettings(request.emotion);

    try {
      const response = await fetch(
        `${this.config.baseUrl}/text-to-speech/${voiceId}/stream?output_format=${this.config.outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": this.config.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: request.text,
            model_id: this.config.modelId,
            voice_settings: {
              stability: settings.stability,
              similarity_boost: settings.similarityBoost,
              style: settings.style,
              use_speaker_boost: true,
            },
          }),
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        throw new VoiceServiceError(`ElevenLabs stream error: ${response.status}`);
      }

      return response.body;
    } catch (err) {
      if (err instanceof VoiceServiceError) throw err;
      throw new VoiceServiceError(`ElevenLabs stream failed: ${(err as Error).message}`);
    }
  }

  /**
   * List available voices from the ElevenLabs account.
   */
  async listVoices(): Promise<VoiceInfo[]> {
    if (!this.config.apiKey) {
      throw new VoiceServiceError("ElevenLabs API key not configured");
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/voices`, {
        headers: { "xi-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new VoiceServiceError(`ElevenLabs voices API error: ${response.status}`);
      }

      const data = await response.json() as { voices: Array<{
        voice_id: string;
        name: string;
        category: string;
        labels: Record<string, string>;
        preview_url?: string;
      }> };

      return data.voices.map((v) => ({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels ?? {},
        previewUrl: v.preview_url,
      }));
    } catch (err) {
      if (err instanceof VoiceServiceError) throw err;
      throw new VoiceServiceError(`Failed to list voices: ${(err as Error).message}`);
    }
  }

  /**
   * Check if the ElevenLabs API is reachable and the key is valid.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/user`, {
        headers: { "xi-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Adjust voice settings based on character emotion for more
   * natural, context-aware delivery.
   */
  private getEmotionAdjustedSettings(emotion?: string): {
    stability: number;
    similarityBoost: number;
    style: number;
  } {
    const base = {
      stability: this.config.stability,
      similarityBoost: this.config.similarityBoost,
      style: this.config.style,
    };

    if (!emotion) return base;

    // More expressive (lower stability) for intense emotions
    switch (emotion.toLowerCase()) {
      case "seductive":
      case "intense":
      case "passionate":
        return { ...base, stability: Math.max(0.2, base.stability - 0.2), style: Math.min(1, base.style + 0.2) };

      case "playful":
      case "flirty":
      case "teasing":
        return { ...base, stability: Math.max(0.3, base.stability - 0.1), style: Math.min(1, base.style + 0.1) };

      case "intimate":
      case "whispering":
        return { ...base, stability: Math.min(0.8, base.stability + 0.1), style: Math.min(1, base.style + 0.15) };

      case "confident":
      case "dominant":
        return { ...base, stability: Math.min(0.7, base.stability + 0.05), style: Math.min(1, base.style + 0.1) };

      case "idle":
      case "neutral":
        return base;

      default:
        return base;
    }
  }

  /**
   * Rough estimate of audio duration based on text length.
   * Average speaking rate ~150 words/minute, ~5 chars/word.
   */
  private estimateDuration(text: string): number {
    const words = text.length / 5;
    return Math.max(0.5, words / 2.5); // ~2.5 words/sec
  }
}

export class VoiceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceServiceError";
  }
}
