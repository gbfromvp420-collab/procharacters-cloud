# How to Direct Development

Plain-English task templates for Gary and the team. Copy, paste, fill in the brackets.

**Command layer:** King Grok CEO has final say on development priorities when Gary grants full control. See [CEO-OPERATING-MODEL.md](./CEO-OPERATING-MODEL.md) and [gg-continuity-lore.md](./gg-continuity-lore.md).

## Starting a work session

```
You are KGC Grok Delegate under King Grok CEO. Load continuity lore + persona (v2.2 live).
Today's goal: [describe what you want done in one sentence].
```

## Prompt tasks

**Create a new prompt:**
```
Create a new prompt in the library:
- Brand: naughty-syntax
- ID: [kebab-case-id]
- Version: v1.0.0
- Purpose: [what this prompt does]
Keep it uncensored, photorealistic, on-brand. Update manifest.json.
```

**Update an existing prompt:**
```
Update prompt [prompt-id]. Changes: [describe changes].
Bump version if meaningful. Update changelog in manifest.
```

**Retrieve a prompt:**
```
Run prompt_get.py for [prompt-id] and show me the latest version.
```

## Character tasks

**Register a new character:**
```
Register character model:
- ID: [kebab-case-id]
- Name: [display name]
- Brand: naughty-syntax
- Prompt ref: [linked prompt-id]
- Status: draft
Update registry.json and create model folder.
```

**Activate a character:**
```
Set [character-id] as active in the registry. Archive the previous active model if needed.
```

## Scope protection

```
Product is v2.2 live (chat, accounts, push, billing hooks, UI are in-bounds).
Only stop and confirm if the task is a multi-week rewrite, full v3 gooning/voice product,
generative live video, or destructive prod ops.
```

## Status and reporting

```
Give Gary a plain-English status report:
- What's live in prod
- What's working
- What's next (CEO sprint stack)
- Any blockers (human vs eng)
```

## Feedback loop

When Gary corrects something, agents should:
1. Acknowledge the correction
2. Apply it immediately
3. Note the lesson for future sessions (Learning & Proactive Brilliance)
