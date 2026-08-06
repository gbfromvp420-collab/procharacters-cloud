#!/usr/bin/env python3
"""Automated smoke test: boot app, serve /, WebRTC + chat routes intact."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from app.main import app


def main() -> int:
    failures: list[str] = []

    with TestClient(app) as client:
        # 1) Root serves HTML client with character hot-swap UI
        r = client.get("/")
        if r.status_code != 200:
            failures.append(f"GET / -> {r.status_code}")
        else:
            ct = r.headers.get("content-type", "")
            if "text/html" not in ct:
                failures.append(f"GET / content-type={ct!r}")
            body = r.text
            if "RTCPeerConnection" not in body and "WebRTC" not in body:
                failures.append("GET / body missing WebRTC client markers")
            if "localVideo" not in body or "remoteVideo" not in body:
                failures.append("GET / body missing video elements")
            # Character / LoRA selector + hot-swap wiring
            for marker in (
                "characterSelect",
                "loraSelect",
                "btnSwap",
                "Swap Character",
                "/api/v1/trainer/weights",
                "/api/v1/webrtc/session",
                "/api/v1/chat/perform",
                "lora_id",
                "character_id",
                "loadWeights",
                "swapCharacter",
            ):
                if marker not in body:
                    failures.append(f"GET / body missing frontend marker {marker!r}")

        # 2) Static mount
        r = client.get("/static/index.html")
        if r.status_code != 200:
            failures.append(f"GET /static/index.html -> {r.status_code}")
        else:
            if "btnSwap" not in r.text or "loadWeights" not in r.text:
                failures.append("static index missing hot-swap JS")

        # 3) Health
        r = client.get("/health")
        if r.status_code != 200 or r.json().get("status") != "ok":
            failures.append(f"GET /health -> {r.status_code} {r.text}")

        # 4) WebRTC discovery
        r = client.get("/api/v1/webrtc")
        if r.status_code != 200:
            failures.append(f"GET /api/v1/webrtc -> {r.status_code}")
        else:
            data = r.json()
            if data.get("service") != "webrtc":
                failures.append(f"GET /api/v1/webrtc unexpected: {data}")

        # 5) ICE servers
        r = client.get("/api/v1/webrtc/ice-servers")
        if r.status_code != 200:
            failures.append(f"GET /api/v1/webrtc/ice-servers -> {r.status_code}")
        else:
            ice = r.json().get("iceServers") or []
            if not ice:
                failures.append("iceServers empty")

        # 5b) Weights list endpoint (frontend dropdown source)
        r = client.get("/api/v1/trainer/weights")
        if r.status_code != 200:
            failures.append(f"GET /api/v1/trainer/weights -> {r.status_code} {r.text}")
        else:
            w = r.json()
            if "weights" not in w:
                failures.append(f"weights payload missing weights key: {w}")

        # 5c) Register a weight so dropdown population has data, then hot-swap session
        r = client.post(
            "/api/v1/trainer/weights/register",
            json={
                "character_id": "smoke-char",
                "kind": "visual_lora",
                "weight_id": "lora-smoke-1",
                "lora_id": "lora-smoke-1",
                "trigger_word": "smokex",
                "set_active": True,
            },
        )
        if r.status_code != 200:
            failures.append(f"POST weights/register -> {r.status_code} {r.text}")

        # 5d) Session init with character + lora (frontend Init / Swap path)
        session_id = "smoke-session-1"
        r = client.post(
            "/api/v1/webrtc/session",
            json={
                "session_id": session_id,
                "character_id": "smoke-char",
                "lora_id": "lora-smoke-1",
            },
        )
        if r.status_code != 200:
            failures.append(f"POST /api/v1/webrtc/session -> {r.status_code} {r.text}")
        else:
            sess = r.json()
            if sess.get("character_id") != "smoke-char":
                failures.append(f"session character_id: {sess}")
            if sess.get("lora_id") != "lora-smoke-1":
                failures.append(f"session lora_id: {sess}")
            if not isinstance(sess.get("weights"), dict):
                failures.append(f"session missing weights: {sess}")

        # 5e) Hot-swap to another lora without offer/hangup
        r = client.post(
            "/api/v1/trainer/weights/register",
            json={
                "character_id": "smoke-char",
                "kind": "visual_lora",
                "weight_id": "lora-smoke-2",
                "lora_id": "lora-smoke-2",
                "set_active": False,
            },
        )
        if r.status_code != 200:
            failures.append(f"register lora-2 -> {r.status_code} {r.text}")

        r = client.post(
            "/api/v1/webrtc/session",
            json={
                "session_id": session_id,
                "character_id": "smoke-char",
                "lora_id": "lora-smoke-2",
            },
        )
        if r.status_code != 200:
            failures.append(f"hot-swap session -> {r.status_code} {r.text}")
        else:
            swapped = r.json()
            if swapped.get("lora_id") != "lora-smoke-2":
                failures.append(f"hot-swap lora not applied: {swapped}")

        # 6) Offer / answer negotiation (with lora_id)
        offer_sdp = (
            "v=0\r\n"
            "o=- 0 0 IN IP4 127.0.0.1\r\n"
            "s=-\r\n"
            "t=0 0\r\n"
            "a=group:BUNDLE 0 1\r\n"
            "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n"
            "c=IN IP4 0.0.0.0\r\n"
            "a=mid:0\r\n"
            "a=sendrecv\r\n"
            "a=rtpmap:111 opus/48000/2\r\n"
            "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n"
            "c=IN IP4 0.0.0.0\r\n"
            "a=mid:1\r\n"
            "a=sendrecv\r\n"
            "a=rtpmap:96 VP8/90000\r\n"
        )
        r = client.post(
            "/api/v1/webrtc/offer",
            json={
                "session_id": session_id,
                "sdp": offer_sdp,
                "type": "offer",
                "character_id": "smoke-char",
                "lora_id": "lora-smoke-2",
            },
        )
        if r.status_code != 200:
            failures.append(f"POST /api/v1/webrtc/offer -> {r.status_code} {r.text}")
        else:
            ans = r.json()
            if not ans.get("sdp") or ans.get("type") != "answer":
                failures.append(f"offer response incomplete: {ans}")
            if ans.get("character_id") != "smoke-char":
                failures.append(f"offer answer character_id: {ans}")
            if ans.get("lora_id") != "lora-smoke-2":
                failures.append(f"offer answer lora_id: {ans}")

        # 7) ICE candidate POST
        r = client.post(
            "/api/v1/webrtc/ice-candidate",
            json={
                "session_id": session_id,
                "candidate": {
                    "candidate": "candidate:1 1 UDP 2122252543 127.0.0.1 54321 typ host",
                    "sdpMid": "0",
                    "sdpMLineIndex": 0,
                },
            },
        )
        if r.status_code != 200 or not r.json().get("ok"):
            failures.append(f"POST ice-candidate -> {r.status_code} {r.text}")

        # 8) Session lookup
        r = client.get(f"/api/v1/webrtc/session/{session_id}")
        if r.status_code != 200:
            failures.append(f"GET session -> {r.status_code}")
        else:
            s = r.json()
            if not s.get("has_offer") or not s.get("has_answer"):
                failures.append(f"session flags wrong: {s}")
            if s.get("lora_id") != "lora-smoke-2":
                failures.append(f"session lora after offer: {s}")

        # 9) versioned chat/perform with lora_id
        r = client.post(
            "/api/v1/chat/perform",
            json={
                "session_id": session_id,
                "character_id": "smoke-char",
                "lora_id": "lora-smoke-2",
                "message": "hello smoke test",
            },
        )
        if r.status_code != 200:
            failures.append(f"POST /api/v1/chat/perform -> {r.status_code} {r.text}")
        else:
            body = r.json()
            if not body.get("ok") or not body.get("reply"):
                failures.append(f"chat/perform body: {body}")
            if "performance" not in body:
                failures.append("chat/perform missing performance")
            if body.get("lora_id") != "lora-smoke-2":
                failures.append(f"chat/perform lora_id: {body}")
            if not isinstance(body.get("weights"), dict):
                failures.append(f"chat/perform missing weights: {body}")

        # 9b) legacy /chat/perform still works
        r = client.post(
            "/chat/perform",
            json={
                "session_id": session_id,
                "character_id": "smoke-char",
                "lora_id": "lora-smoke-1",
                "message": "legacy path",
            },
        )
        if r.status_code != 200:
            failures.append(f"POST /chat/perform -> {r.status_code} {r.text}")

        # 10) CORS preflight for local origins
        for origin in ("http://localhost:8000", "http://127.0.0.1:8000"):
            r = client.options(
                "/api/v1/webrtc/ice-servers",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            allow = r.headers.get("access-control-allow-origin")
            if allow not in (origin, "*"):
                failures.append(
                    f"CORS preflight origin={origin} allow-origin={allow!r} status={r.status_code}"
                )

        # 11) Hangup
        r = client.post("/api/v1/webrtc/hangup", json={"session_id": session_id})
        if r.status_code != 200 or not r.json().get("ok"):
            failures.append(f"hangup -> {r.status_code} {r.text}")

    if failures:
        print("SMOKE FAILED")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("SMOKE OK")
    print("  GET /                     -> 200 HTML + character/LoRA hot-swap UI")
    print("  GET /static/index.html    -> 200")
    print("  GET /api/v1/trainer/weights -> 200")
    print("  POST /api/v1/webrtc/session -> hot-swap character/lora")
    print("  GET /api/v1/webrtc        -> 200")
    print("  GET /api/v1/webrtc/ice-servers -> 200")
    print("  POST /api/v1/webrtc/offer -> 200 answer SDP + lora_id")
    print("  POST /api/v1/webrtc/ice-candidate -> 200")
    print("  POST /api/v1/chat/perform -> 200 with weights")
    print("  POST /chat/perform        -> 200 legacy")
    print("  CORS localhost + 127.0.0.1:8000 -> OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
