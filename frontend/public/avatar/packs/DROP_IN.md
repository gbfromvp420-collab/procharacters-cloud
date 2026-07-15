# Avatar pack drop-in (Phase 4)

## How to add dedicated clips

For each model folder, add **four seamless loops** (4–8s, 9:16 preferred):

```
frontend/public/avatar/<model-id>/
  idle.mp4
  teasing.mp4
  playful.mp4
  aroused.mp4
```

### Model IDs

| Folder | Interim base until ready |
|--------|---------------------------|
| `twink-shy-boy` | twink-default |
| `twink-gym` | twink-default |
| `twink-alt-punk` | twink-default |
| `female-soft-goth` | female-default |
| `female-athletic-tease` | female-default |
| `female-playful-brat` | female-default |

Briefs: `PHASE4_CLIP_BRIEFS.md` + `docs/phase5-custom-v2-and-avatar-clips.md`

## After dropping files

```bash
cd backend
npm run avatar:check-packs -- --write
```

That refreshes `packs/status.json`. Redeploy **web** (files) and **api** (status + resolver cache).

## Runtime behavior

1. If all 4 files exist for `<id>` → primary `/avatar/<id>/…`  
2. Client `mediaFallbackUrl` still points at interim base if primary 404s  
3. Until ready → primary is interim base only  

No catalog code change required for a new pack once files + status are present.
