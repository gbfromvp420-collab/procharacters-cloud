export interface RegistryEntry {
  id: string;
  name: string;
  brand: string;
  status: string;
  prompt_ref: string;
  version: string;
  path: string;
  content_policy: {
    rating: string;
    audiences: string[];
    uncensored: boolean;
  };
}

export interface CharacterRegistry {
  version: string;
  registry: string;
  active_models: Record<string, string>;
  entries: RegistryEntry[];
}