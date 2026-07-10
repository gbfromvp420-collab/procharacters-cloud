export {
  LIVE_CHARACTER_CATALOG,
  LIVE_CHARACTER_IDS,
  LiveCharacterError,
  assertLiveCharacter,
  getLiveCharacterProfile,
  resolveAvatarBaseId,
} from "./character-catalog.js";
export {
  createCustomCharacter,
  getCustomCharacter,
  listCustomCharacters,
} from "./custom-characters.js";
export type {
  CustomAvatarBase,
  CustomCharacterInput,
  CustomCharacterRecord,
} from "./custom-characters.js";
export { detectMissingTraits, buildConsistencyReminder } from "./consistency.js";
export { LivePromptInjector } from "./injector.js";
export { formatMemoryBlock, toLlmMessages } from "./memory-context.js";
export { createPromptSnapshot } from "./prompt-snapshot.js";
export type {
  LiveInjectionResult,
  LlmMessage,
  PromptLayers,
  PromptSnapshot,
  SessionMemoryInput,
} from "./types.js";