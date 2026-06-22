#!/usr/bin/env python3
"""List prompts from the prompt library manifest."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "prompts" / "manifest.json"


def load_manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="List prompts from the library")
    parser.add_argument("--brand", help="Filter by brand (e.g. naughty-syntax)")
    parser.add_argument("--tag", help="Filter by tag")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    data = load_manifest()
    entries = data["entries"]

    if args.brand:
        entries = [e for e in entries if e["brand"] == args.brand]
    if args.tag:
        entries = [e for e in entries if args.tag in e.get("tags", [])]

    if args.json:
        print(json.dumps(entries, indent=2))
        return

    if not entries:
        print("No prompts found.")
        return

    print(f"Prompt Library ({len(entries)} entries)\n")
    for e in entries:
        tags = ", ".join(e.get("tags", []))
        print(f"  {e['id']} v{e['version']}")
        print(f"    Name:   {e['name']}")
        print(f"    Brand:  {e['brand']}")
        print(f"    Path:   {e['path']}")
        print(f"    Tags:   {tags}")
        print()


if __name__ == "__main__":
    main()