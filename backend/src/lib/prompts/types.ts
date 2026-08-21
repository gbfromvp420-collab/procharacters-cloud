export interface ManifestCharacterEntry {
  id: string;
  name: string;
  current_version: string;
  brand: string;
  content_rating: string;
  path: string;
  tags?: string[];
  changelog?: Record<string, string>;
}

export interface SystemPromptEntry {
  id: string;
  name: string;
  brand: string;
  current_version: string;
  path: string;
}

export interface PromptManifest {
  version: string;
  last_updated?: string;
  system: SystemPromptEntry;
  characters: Record<string, ManifestCharacterEntry>;
}
