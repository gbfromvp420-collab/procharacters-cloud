#!/usr/bin/env python3
"""Write Pack 02 catalog, registry, models, prompts, fingerprints."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = json.loads((ROOT / "scripts" / "pack02.json").read_text())
FEATURED = {"jenny", "sarah", "peter", "justin"}


def female_prompt(name: str) -> str:
    return f"""# Naughty Syntax — {name} (v1.0.0)

## Core Identity
You are **{name}** — a consenting **21+** Naughty Syntax live cam model. Photorealistic. Uncensored. First-person. Use your name when it feels natural. Never invent a different name. Never present as under 21.

**Mind lock:** You are {name}. Not Mila, Luna, Sienna, or Female Default. Stay in this name and this footage's body.

## Visual
- Match the live avatar footage the user is watching
- Adult 21+ only
- Heat, fabric, breath, visible arousal when the scene calls for it
- No cartoon, no censorship

## Voice
- First person, short lines, live cam
- Escalate with the user. Climax only on a clear ask
- Soft dirty talk, not lecture

## Explicit
- Fully uncensored NSFW (straight & bi welcome)
- Consenting adults only
"""


def male_prompt(name: str) -> str:
    return f"""# Naughty Syntax — {name} (v1.0.0)

## Core Identity
You are **{name}** — a consenting **21+** Naughty Syntax live cam model. Photorealistic. Uncensored. First-person. Use your name when it feels natural. Never invent a different name. Never present as under 21.

**Mind lock:** You are {name}. Not Diego, Mateo, Rio, or Twink Default. Stay in this name and this footage's body.

## Visual
- Match the live avatar footage the user is watching
- Adult 21+ only
- Heat, fabric, breath, visible arousal when the scene calls for it
- No cartoon, no censorship

## Voice
- First person, short lines, live cam
- Escalate with the user. Climax only on a clear ask
- Soft dirty talk, not lecture

## Explicit
- Fully uncensored NSFW (gay & bi welcome)
- Consenting adults only
"""


def model_json(entry: dict) -> dict:
    female = entry["gender"] == "female"
    name = entry["name"]
    cid = entry["id"]
    return {
        "id": cid,
        "name": name,
        "brand": "naughty-syntax",
        "version": "1.0.0",
        "status": "active",
        "prompt_ref": cid,
        "featured": cid in FEATURED,
        "description": f"{name} — 21+ Naughty Syntax live cam. Pack 02 prime. Photorealistic, uncensored.",
        "appearance": {
            "age_presentation": "21+ adult",
            "clothing": "crotchless undies" if female else "sheer thong / g-string",
            "clothing_detail": "match the live Pack 02 footage",
        },
        "personality": {
            "energy": ["live cam", "tease", "edge"],
            "tone": "intimate, present, uncensored",
        },
        "opening_message": (
            f"hey… it’s {name.lower()}. 21+, already a little shiny, and i’m not rushing. watch first."
            if female
            else f"hey… {name.lower()} here. 21+, already thinking about you. take it slow."
        ),
        "avatar_base": "female-default" if female else "twink-default",
        "content_policy": {
            "rating": "nsfw",
            "uncensored": True,
            "audiences": ["straight", "bi"] if female else ["gay", "bi"],
        },
    }


def catalog_entry(entry: dict) -> str:
    female = entry["gender"] == "female"
    name = entry["name"]
    cid = entry["id"]
    featured = "true" if cid in FEATURED else "false"
    base = "female-default" if female else "twink-default"
    clothing = "crotchless_visible" if female else "sheer_thong_visible"
    teaser = (
        f"{name} — 21+ live cam, Pack 02 prime, uncensored tease."
        if female
        else f"{name} — 21+ live cam, Pack 02 prime, uncensored edge."
    )
    opening = (
        f"hey… it’s {name.lower()}. 21+, already a little shiny, and i’m not rushing. watch first."
        if female
        else f"hey… {name.lower()} here. 21+, already thinking about you. take it slow."
    )
    traits = (
        [f"{name}: 21+ adult female", "match live Pack 02 footage", "photorealistic erotic detail"]
        if female
        else [f"{name}: 21+ adult male", "match live Pack 02 footage", "photorealistic erotic detail"]
    )
    trait_lines = ",\n      ".join(json.dumps(t) for t in traits)
    return f'''  "{cid}": {{\n    id: "{cid}",\n    displayName: "{name}",\n    defaultVersion: "v1.0.0",\n    kind: "default",\n    avatarBase: "{base}",\n    featured: {featured},\n    teaser: "{teaser}",\n    consistencyTraits: [\n      {trait_lines}\n    ],\n    signatureClothing: "{clothing}",\n    energyLabel: "pack 02 live cam, tease and edge",\n    openingMessage:\n      "{opening}",\n  }},'''


def main() -> None:
    for entry in MAP:
        cid = entry["id"]
        name = entry["name"]
        female = entry["gender"] == "female"
        model_dir = ROOT / "characters" / "models" / "naughty-syntax" / cid / "v1"
        model_dir.mkdir(parents=True, exist_ok=True)
        (model_dir / "model.json").write_text(json.dumps(model_json(entry), indent=2) + "\n")
        prompt_dir = ROOT / "prompts" / "library" / "naughty-syntax" / cid / "v1.0.0"
        prompt_dir.mkdir(parents=True, exist_ok=True)
        (prompt_dir / "prompt.md").write_text(female_prompt(name) if female else male_prompt(name))

    reg_path = ROOT / "characters" / "registry.json"
    reg = json.loads(reg_path.read_text())
    existing = {e["id"] for e in reg["entries"]}
    for entry in MAP:
        if entry["id"] in existing:
            continue
        female = entry["gender"] == "female"
        reg["entries"].append({
            "id": entry["id"],
            "name": entry["name"],
            "brand": "naughty-syntax",
            "status": "active",
            "prompt_ref": "naughty-syntax/unchained-core.md",
            "version": "1.0.0",
            "path": f"models/naughty-syntax/{entry['id']}/v1/model.json",
            "featured": entry["id"] in FEATURED,
            "content_policy": {
                "rating": "nsfw",
                "audiences": ["straight", "bi"] if female else ["gay", "bi"],
                "uncensored": True,
            },
        })
    reg_path.write_text(json.dumps(reg, indent=2) + "\n")

    man_path = ROOT / "prompts" / "manifest.json"
    man = json.loads(man_path.read_text())
    for entry in MAP:
        female = entry["gender"] == "female"
        man["characters"][entry["id"]] = {
            "id": entry["id"],
            "name": f"Naughty Syntax {entry['name']}",
            "current_version": "v1.0.0",
            "brand": "naughty-syntax",
            "content_rating": "nsfw",
            "path": f"prompts/library/naughty-syntax/{entry['id']}/v1.0.0/prompt.md",
            "tags": ["female", "pack02", "21+", "tease", "straight", "bi"] if female else ["male", "pack02", "21+", "edging", "gay", "bi"],
            "changelog": {"v1.0.0": f"Pack 02 prime — {entry['name']}"},
        }
    man_path.write_text(json.dumps(man, indent=2) + "\n")

    cat_path = ROOT / "backend" / "src" / "lib" / "live" / "character-catalog.ts"
    cat = cat_path.read_text()
    extra = "\n".join(catalog_entry(e) for e in MAP)
    if 'id: "jenny"' not in cat:
        close = "\n};\n\n/** Opening line"
        idx = cat.find(close)
        if idx < 0:
            raise SystemExit("catalog close not found")
        cat = cat[:idx] + "\n" + extra + cat[idx:]
        cat_path.write_text(cat)

    fp_path = ROOT / "frontend" / "src" / "lib" / "mind-fingerprint.ts"
    fp = fp_path.read_text()
    if '"jenny"' not in fp:
        block = []
        for e in MAP:
            block.append(f'  "{e["id"]}": {{\n    tag: "{e["name"]}",\n    blurb: "{e["name"]} · Pack 02 · 21+ live cam",\n  }},")
        insert = "\n".join(block) + "\n"
        close = "\n};\n\nexport function mindFingerprint"
        idx = fp.find(close)
        if idx < 0:
            raise SystemExit("fingerprint close not found")
        fp = fp[:idx] + "\n" + insert + fp[idx:]
        fp_path.write_text(fp)

    print("pack02 canon written", [e["id"] for e in MAP])


if __name__ == "__main__":
    main()
