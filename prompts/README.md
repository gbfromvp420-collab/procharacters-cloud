# Prompt Library

Versioned storage for all Procharacters.cloud and Naughty Syntax prompts.

## Structure

```
prompts/
├── manifest.json          # Index of all prompts
└── library/
    └── <brand>/
        └── <name>/
            └── <version>/
                └── prompt.md
```

## Manifest fields

| Field | Description |
|-------|-------------|
| `id` | Stable identifier (kebab-case) |
| `version` | Semver (e.g. `1.0.0`) |
| `brand` | Brand namespace (`naughty-syntax`) |
| `name` | Human-readable name |
| `content_rating` | Always `nsfw` for this project |
| `path` | Relative path to prompt file |
| `tags` | Filter tags for retrieval |
| `changelog` | Version history notes |

## Usage

```bash
python scripts/prompt_list.py
python scripts/prompt_list.py --brand naughty-syntax
python scripts/prompt_get.py --id system-core
python scripts/prompt_get.py --id twink-default --version 1.0.0
```

## Versioning rules

- **Patch** (1.0.1): Typos, minor wording tweaks
- **Minor** (1.1.0): New sections, expanded detail, non-breaking changes
- **Major** (2.0.0): Breaking restructure or complete rewrite

Always update `manifest.json` when adding or changing prompts.