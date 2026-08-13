#!/usr/bin/env python3
"""Fetch Pack 02 Drive primes, cut 4 loops, copy to live avatar folders, update status.json."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = json.loads((ROOT / "scripts" / "pack02.json").read_text())
WHO = (sys.argv[1] if len(sys.argv) > 1 else "all").strip().lower()


def run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=ROOT, env=env)


def cook(entry: dict) -> None:
    who = entry["who"]
    folder = entry["id"]
    url = entry["drive"]
    prime_name = f"{who}_prime.mp4"
    print(f"\u2550\u2550 {who} \u2192 {folder}", flush=True)
    run(["bash", "scripts/fetch-prime.sh", url, prime_name])
    prime = ROOT / "packs" / "inbox" / prime_name
    dur = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nk=1:nw=1",
            str(prime),
        ],
        text=True,
    ).strip()
    print(f"duration {dur}s", flush=True)
    win = subprocess.check_output(["python3", "scripts/prime-windows.py", dur], text=True)
    lines = [ln.strip() for ln in win.splitlines() if ln.strip()]
    offsets, durs = lines[0], lines[1]
    print("offsets", offsets)
    print("durs", durs)
    env = dict(os.environ)
    env["OFFSETS"] = offsets
    env["DURATIONS"] = durs
    env["FADE"] = "0.4"
    env["SCALE_9_16"] = "1"
    out = ROOT / "packs" / folder
    if out.exists():
        for p in out.glob("*.mp4"):
            p.unlink()
    run(["bash", "scripts/cut-loops.sh", str(prime), folder], env=env)
    dest = ROOT / "frontend" / "public" / "avatar" / folder
    dest.mkdir(parents=True, exist_ok=True)
    for clip in ("idle", "teasing", "playful", "aroused"):
        src = ROOT / "packs" / folder / f"{clip}.mp4"
        (dest / f"{clip}.mp4").write_bytes(src.read_bytes())
    readme = dest / "README.md"
    if not readme.exists():
        readme.write_text(
            f"# {folder} \u2014 dedicated pack\n\n"
            f"Pack 02 \u00b7 {entry['name']} \u00b7 idle / teasing / playful / aroused\n"
        )


def update_status(ids: list[str]) -> None:
    path = ROOT / "frontend" / "public" / "avatar" / "packs" / "status.json"
    doc = json.loads(path.read_text())
    ready = set(doc.get("ready") or [])
    packs = dict(doc.get("packs") or {})
    for folder in ids:
        ready.add(folder)
        gender = next(e["gender"] for e in MAP if e["id"] == folder)
        packs[folder] = {
            "ready": True,
            "missing": [],
            "avatarBase": "female-default" if gender == "female" else "twink-default",
        }
    doc["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    doc["ready"] = sorted(ready)
    doc["packs"] = dict(sorted(packs.items()))
    path.write_text(json.dumps(doc, indent=2) + "\n")


def main() -> None:
    if WHO == "all":
        batch = MAP
    else:
        batch = [e for e in MAP if e["who"] == WHO]
        if not batch:
            raise SystemExit(f"unknown who={WHO}")
    for entry in batch:
        cook(entry)
    update_status([e["id"] for e in batch])
    print("pack02 cook done", [e["who"] for e in batch])


if __name__ == "__main__":
    main()
