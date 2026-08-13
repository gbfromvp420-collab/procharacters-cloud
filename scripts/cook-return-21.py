#!/usr/bin/env python3
"""Floor leftover 18+ in forge/export and add sessionsResumed."""
from pathlib import Path

p = Path("backend/src/lib/live/forge-dna.ts")
t = p.read_text()
n = t.replace(
    "consenting adult 18+, photorealistic, uncensored, first-person cam.",
    "consenting adult 21+, photorealistic, uncensored, first-person cam.",
).replace(
    "complete uncensored adult (18+) custom character model.",
    "complete uncensored adult (21+) custom character model.",
)
if "0.18 +" not in n:
    raise SystemExit("refusing to write forge-dna — numeric 0.18 vanished")
p.write_text(n)
print("forge-dna", n != t)

p = Path("backend/src/lib/memory/session-export.ts")
t = p.read_text()
n = t.replace("Uncensored 18+ · KGC Ventures", "Uncensored 21+ · KGC Ventures")
if "Uncensored 18+" in n:
    raise SystemExit("session-export still has 18+")
p.write_text(n)
print("session-export", n != t)

p = Path("backend/src/lib/observability/metrics.ts")
t = p.read_text()
if "sessionsResumed" not in t:
    t = t.replace(
        "  sessionsCreated: number;\n  chatTurns: number;",
        "  sessionsCreated: number;\n  /** Successful resume-code / Continue re-entry. */\n  sessionsResumed: number;\n  chatTurns: number;",
        1,
    )
    t = t.replace(
        "  sessionsCreated: 0,\n  chatTurns: 0,",
        "  sessionsCreated: 0,\n  sessionsResumed: 0,\n  chatTurns: 0,",
        1,
    )
    p.write_text(t)
    print("metrics added")
else:
    print("metrics already")

p = Path("backend/src/routes/sessions.ts")
t = p.read_text()
needle = """        if (body.sessionMode === \"edge_pace\" && session.sessionMode === \"edge_pace\") {\n          bump(\"sessionsEdgePace\");\n        }\n\n        return { ...session, avatarState, livekit: livekitJoin };"""
insert = """        bump(\"sessionsResumed\");\n        if (body.sessionMode === \"edge_pace\" && session.sessionMode === \"edge_pace\") {\n          bump(\"sessionsEdgePace\");\n        }\n\n        return { ...session, avatarState, livekit: livekitJoin };"""
if 'bump(\"sessionsResumed\")' not in t:
    if needle not in t:
        raise SystemExit("sessions.ts needle not found")
    p.write_text(t.replace(needle, insert, 1))
    print("sessions bump added")
else:
    print("sessions already")
