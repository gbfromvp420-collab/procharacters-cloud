export interface ContentPolicy {
  rating: string;
  uncensored: boolean;
  audiences: string[];
}

export interface CharacterModelJson {
  id: string;
  name: string;
  brand: string;
  version: string;
  status: string;
  prompt_ref: string;
  description: string;
  appearance: Record<string, string>;
  personality: {
    energy: string[];
    tone: string;
  };
  content_policy: ContentPolicy;
}

export interface CharacterBundle {
  id: string;
  name: string;
  brand: string;
  promptVersion: string;
  promptPath: string;
  promptBody: string;
  model: CharacterModelJson;
  appearanceAnchor: string;
}

export interface AssembledPrompt {
  characterId: string;
  promptVersion: string;
  systemPrompt: string;
  messageCount: number;
  hash: string;
}
