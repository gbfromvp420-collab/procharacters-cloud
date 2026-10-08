# Custom avatar clip packs

Drop character loop folders here, then point a custom character's **media base** at them.

## Layout

```
public/avatar/packs/<name>/
  idle.mp4
  teasing.mp4
  playful.mp4
  aroused.mp4
```

In the UI (Create Custom → Custom clips), set:

```
/avatar/packs/<name>
```

Or override one emotion with a full URL:

```
https://cdn.example.com/diego-teasing.mp4
```

## Notes

- Packs under `public/avatar/` are served by the **frontend**.
- You can also **upload in the browser** (Create/Edit custom → Upload idle/teasing/playful/aroused).  
  Browser uploads go to the **API** volume (`/data/uploads`) and are served at  
  `https://<api-host>/media/uploads/<characterId>/<emotion>.mp4`.
- Fallback pack (twink/female defaults) is used when a slot is missing.
