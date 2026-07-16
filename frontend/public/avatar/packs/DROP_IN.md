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

That refreshes `packs/status.json`. Redeploy **web** (MP4s in the image) and **api** (resolver + gallery badges).

**Checklist for Gary / content**

1. Export 4 seamless loops (4–8s, 9:16, H.264) named exactly `idle|teasing|playful|aroused.mp4`  
2. Put them in `frontend/public/avatar/<model-id>/`  
3. Run `npm run avatar:check-packs -- --write` from `backend/` — expect `✓ READY`  
4. Commit + deploy web + api  
5. Gallery tile shows **4K pack** (green) instead of **Interim**  
6. `/health` → `avatar.dedicatedReady` lists the id  

## Runtime behavior

1. If all 4 files exist for `<id>` → primary `/avatar/<id>/…` (gallery, card, live chat)  
2. Client `mediaFallbackUrl` still points at interim base if primary 404s  
3. Until ready → primary is interim base only; gallery badge **Interim**  
4. API cache refreshes about every 30s without redeploy if files appear on disk  

No catalog code change required for a new pack once files are present.
