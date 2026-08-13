#!/usr/bin/env python3
"""Print OFFSETS and DURATIONS for a prime of given seconds."""
import sys

D = float(sys.argv[1])
if D < 16:
    raise SystemExit(f"prime too short: {D:.1f}s")

idle, tease, play = 6.0, 5.0, 7.0
if D < 22:
    s = D / 24.0
    idle, tease, play = 6 * s, 5 * s, 7 * s

play_end = idle + tease + play
aroused = min(7.0, max(4.8, D - play_end))
a0 = D - aroused
if a0 < play_end - 0.2:
    play = max(5.0, D - idle - tease - 5.2)
    play_end = idle + tease + play
    aroused = min(7.0, max(4.8, D - play_end))
    a0 = D - aroused

print(f"{0:.1f} {idle:.1f} {idle + tease:.1f} {a0:.1f}")
print(f"{idle:.1f} {tease:.1f} {play:.1f} {aroused:.1f}")
