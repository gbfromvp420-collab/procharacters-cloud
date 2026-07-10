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

- Clips are served by the **frontend** Next.js app (static files).
- After adding files, redeploy **procharacters-web** (or restart local `npm run dev`).
- Fallback pack (twink/female defaults) is used when a slot is missing.
