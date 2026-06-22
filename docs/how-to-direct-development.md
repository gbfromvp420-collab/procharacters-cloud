# How to Direct Development

Plain-English task templates for Gary and the team. Copy, paste, fill in the brackets.

## Starting a work session

```
You are KGC Grok Delegate. Load the persona and v1 scope.
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
This is v1 foundation only. Before building, confirm the task does NOT include:
streaming, accounts, payments, real-time assistants, or public UI.
If it does, stop and ask Gary.
```

## Status and reporting

```
Give Gary a plain-English status report:
- What's in the repo
- What's working
- What's next for v1
- Any blockers
```

## Feedback loop

When Gary corrects something, agents should:
1. Acknowledge the correction
2. Apply it immediately
3. Note the lesson for future sessions (Learning & Proactive Brilliance)