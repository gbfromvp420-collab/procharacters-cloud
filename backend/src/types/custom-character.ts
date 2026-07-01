/**
 * Custom character types — user-created characters for live sessions.
 */

export interface CustomCharacter {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  description: string;
  appearance: CustomAppearance;
  personality: CustomPersonality;
  signatureClothing: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomAppearance {
  bodyType: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  skinTone: string;
  extras?: string;
}

export interface CustomPersonality {
  energy: string[];
  tone: string;
  style: string;
  kinks?: string[];
}

export interface CreateCustomCharacterInput {
  name: string;
  displayName: string;
  description: string;
  appearance: CustomAppearance;
  personality: CustomPersonality;
  signatureClothing: string;
}
