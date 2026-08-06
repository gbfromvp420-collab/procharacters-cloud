# Character Model Management

Registry-based system for defining, switching, and versioning character models.

## Structure

```
characters/
├── registry.json              # Master index + active model pointer
└── models/
    └── <brand>/
        └── <name>/
            └── <version>/
                └── model.json
```

## Registry fields

| Field | Description |
|-------|-------------|
| `id` | Stable identifier (kebab-case) |
| `name` | Display name |
| `brand` | Brand namespace |
| `status` | `draft`, `active`, or `archived` |
| `prompt_ref` | Linked prompt ID from `prompts/manifest.json` |
| `version` | Current model version |
| `path` | Relative path to model.json |

## Switching models

Update `active_models` in `registry.json`. Only one model per slot should be `active` at a time.

Current slots:
- `default_male` — Twink Default
- `default_female` — Female Default

## Usage

```bash
python scripts/character_list.py
python scripts/character_list.py --status active
```

## Adding a new character (v1)

1. Create prompt in `prompts/library/`
2. Add entry to `prompts/manifest.json`
3. Create `model.json` in `characters/models/`
4. Add entry to `characters/registry.json`
5. Set status to `draft` until Gary approves