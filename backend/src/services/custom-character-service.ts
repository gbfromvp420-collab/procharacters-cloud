/**
 * Custom character service — create, list, get, delete user-created characters.
 */

import { randomUUID } from "node:crypto";
import type {
  CreateCustomCharacterInput,
  CustomCharacter,
} from "../types/custom-character.js";

export class CustomCharacterService {
  private readonly characters = new Map<string, CustomCharacter>();

  create(userId: string, input: CreateCustomCharacterInput): CustomCharacter {
    const id = `custom-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const character: CustomCharacter = {
      id,
      userId,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      appearance: input.appearance,
      personality: input.personality,
      signatureClothing: input.signatureClothing,
      createdAt: now,
      updatedAt: now,
    };

    this.characters.set(id, character);
    return character;
  }

  listByUser(userId: string): CustomCharacter[] {
    return [...this.characters.values()].filter((c) => c.userId === userId);
  }

  get(characterId: string): CustomCharacter | null {
    return this.characters.get(characterId) ?? null;
  }

  delete(characterId: string, userId: string): boolean {
    const char = this.characters.get(characterId);
    if (!char || char.userId !== userId) return false;
    this.characters.delete(characterId);
    return true;
  }

  update(characterId: string, userId: string, patch: Partial<CreateCustomCharacterInput>): CustomCharacter | null {
    const char = this.characters.get(characterId);
    if (!char || char.userId !== userId) return null;

    const updated: CustomCharacter = {
      ...char,
      ...patch,
      appearance: patch.appearance ?? char.appearance,
      personality: patch.personality ?? char.personality,
      updatedAt: new Date().toISOString(),
    };

    this.characters.set(characterId, updated);
    return updated;
  }
}
