#!/usr/bin/env python3
"""Retrieve a prompt by ID and optional version."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "prompts" / "manifest.json"


def load_manifest():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def parse_version(version_str):
    """Convert folder version (v1.0.0) or manifest version (1.0.0) for comparison."""
    return version_str.lstrip("v")


def main():
    parser = argparse.ArgumentParser(description="Get a prompt by ID")
    parser.add_argument("--id", required=True, help="Prompt ID")
    parser.add_argument("--version", help="Specific version (e.g. 1.0.0). Defaults to latest.")
    parser.add_argument("--meta-only", action="store_true", help="Show metadata only, not prompt body")
    args = parser.parse_args()

    data = load_manifest()
    matches = [e for e in data["entries"] if e["id"] == args.id]

    if not matches:
        print(f"Error: No prompt found with id '{args.id}'")
        raise SystemExit(1)

    if args.version:
        target = parse_version(args.version)
        entry = next((e for e in matches if parse_version(e["version"]) == target), None)
        if not entry:
            print(f"Error: No version '{args.version}' for prompt '{args.id}'")
            raise SystemExit(1)
    else:
        entry = max(matches, key=lambda e: [int(x) for x in parse_version(e["version"]).split(".")])

    prompt_path = ROOT / "prompts" / entry["path"]

    print(f"ID:      {entry['id']}")
    print(f"Version: {entry['version']}")
    print(f"Name:    {entry['name']}")
    print(f"Brand:   {entry['brand']}")
    print(f"Path:    {entry['path']}")
    print()

    if args.meta_only:
        return

    if not prompt_path.exists():
        print(f"Error: Prompt file not found at {prompt_path}")
        raise SystemExit(1)

    print("--- PROMPT ---")
    print(prompt_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()