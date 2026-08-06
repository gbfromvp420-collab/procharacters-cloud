#!/usr/bin/env python3
"""List character models from the registry."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "characters" / "registry.json"


def load_registry():
    with open(REGISTRY, encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="List character models")
    parser.add_argument("--status", choices=["draft", "active", "archived"], help="Filter by status")
    parser.add_argument("--brand", help="Filter by brand")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    data = load_registry()
    entries = data["entries"]

    if args.status:
        entries = [e for e in entries if e["status"] == args.status]
    if args.brand:
        entries = [e for e in entries if e["brand"] == args.brand]

    if args.json:
        print(json.dumps({"active_models": data["active_models"], "entries": entries}, indent=2))
        return

    if not entries:
        print("No characters found.")
        return

    print(f"Character Registry ({len(entries)} entries)\n")
    print("Active slots:")
    for slot, char_id in data["active_models"].items():
        print(f"  {slot}: {char_id}")
    print()

    for e in entries:
        active_marker = ""
        for slot, char_id in data["active_models"].items():
            if char_id == e["id"]:
                active_marker = f" [ACTIVE: {slot}]"
        print(f"  {e['id']} v{e['version']}{active_marker}")
        print(f"    Name:        {e['name']}")
        print(f"    Status:      {e['status']}")
        print(f"    Prompt ref:  {e['prompt_ref']}")
        print(f"    Path:        {e['path']}")
        print()


if __name__ == "__main__":
    main()