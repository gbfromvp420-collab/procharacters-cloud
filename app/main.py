"""
FastAPI application: WebRTC signaling + chat perform + static browser client.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.api.routes.trainer import router as trainer_router
from app.core.config import get_settings
from app.media_bridge import MediaBridge
from app.services.trainer.registry import get_weight_registry

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
INDEX_HTML = STATIC_DIR / "index.html"

# ---------------------------------------------------------------------------
# In-memory session store (smoke / local dev)
# ---------------------------------------------------------------------------

# session_id -> { offer, answer, local_candidates, remote_candidates, character_id, ... }
_sessions: dict[str, dict[str, Any]] = {}


def _get_or_create_session(session_id: str) -> dict[str, Any]:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "session_id": session_id,
            "offer": None,
            "answer": None,
            "local_candidates": [],  # from browser
            "remote_candidates": [],  # toward browser (server-side)
            "character_id": "default",
            "lora_id": None,
            "chat_history": [],
            "state": "new",
        }
    return _sessions[session_id]


def _apply_session_identity(
    session: dict[str, Any],
    *,
    character_id: str | None = None,
    lora_id: str | None = None,
) -> None:
    """Update character / LoRA binding on a session and resolve weight summary."""
    if character_id:
        session["character_id"] = character_id
    if lora_id is not None:
        session["lora_id"] = lora_id or None
    cid = session.get("character_id") or "default"
    lid = session.get("lora_id")
    try:
        weights = get_weight_registry(get_settings()).resolve(cid, lora_id=lid)
        session["weights"] = weights.to_inference_payload()
    except Exception:  # noqa: BLE001
        session["weights"] = {"character_id": cid, "lora_id": lid}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class SDPPayload(BaseModel):
    session_id: str = Field(..., min_length=1)
    sdp: str = Field(..., min_length=1)
    type: str = Field(default="offer")
    character_id: str = Field(default="default")
    lora_id: str | None = Field(
        default=None,
        description="Optional visual LoRA / weight id to bind for this session",
    )


class SDPAnswer(BaseModel):
    session_id: str
    sdp: str
    type: str = "answer"
    character_id: str | None = None
    lora_id: str | None = None


class IceCandidatePayload(BaseModel):
    session_id: str
    candidate: dict[str, Any]


class HangupPayload(BaseModel):
    session_id: str


class SessionUpdatePayload(BaseModel):
    """Bind character_id / lora_id on an existing or new WebRTC session."""

    session_id: str = Field(..., min_length=1)
    character_id: str | None = Field(default=None, min_length=1)
    lora_id: str | None = None


class VideoOnlyRequest(BaseModel):
    """Opt-in generative clip — no chat LLM. Product Grok stays on Railway."""

    session_id: str = Field(..., min_length=1)
    character_id: str = Field(default="default")
    lora_id: str | None = None
    message: str = Field(..., min_length=1)


class VideoOnlyResponse(BaseModel):
    ok: bool
    session_id: str
    character_id: str
    provider: str | None = None
    video_url: str | None = None
    job_id: str | None = None
    duration_ms: int | None = None
    fallback_used: bool = False
    error: str | None = None


class ChatPerformRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    character_id: str = Field(default="default")
    lora_id: str | None = Field(
        default=None,
        description="Optional LoRA / weight id override for this turn",
    )
    message: str = Field(..., min_length=1)


class ChatPerformResponse(BaseModel):
    session_id: str
    character_id: str
    lora_id: str | None = None
    reply: str
    performance: dict[str, Any]
    ok: bool = True
    provider_llm: str | None = None
    provider_video: str | None = None
    fallback_used: bool = False
    weights: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="WebRTC Chat Service",
    version="0.1.0",
    description="Serves the browser WebRTC client and signaling / chat APIs.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model fine-tuning / retuning (avatar LoRA, Unsloth, XTTS)
app.include_router(trainer_router)


# Mount static assets at /static (CSS/JS extras if added later)
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root() -> FileResponse:
    """Serve the WebRTC browser client."""
    # Prefer absolute path so serving works regardless of process cwd.
    index_path = INDEX_HTML if INDEX_HTML.is_file() else Path("app/static/index.html")
    if not index_path.is_file():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(str(index_path), media_type="text/html")


@app.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "video_provider": settings.video_provider,
        "llm_provider": settings.resolved_llm_provider(),
        "training_configured": bool(settings.runpod_training_url),
        "weights_storage_bucket": bool(settings.weights_storage_bucket),
    }


# ---------------------------------------------------------------------------
# WebRTC API  (/api/v1/webrtc/*)
# ---------------------------------------------------------------------------


@app.get("/api/v1/webrtc/ice-servers")
async def webrtc_ice_servers() -> dict[str, list[dict[str, Any]]]:
    """Return STUN (and optional TURN) servers for RTCPeerConnection."""
    settings = get_settings()
    return {"iceServers": settings.ice_servers()}


@app.post("/api/v1/webrtc/offer", response_model=SDPAnswer)
async def webrtc_offer(payload: SDPPayload) -> SDPAnswer:
    """
    Accept a browser SDP offer and return an SDP answer.

    This is a signaling stub suitable for local smoke tests. A production
    media server would generate a real answer SDP with media tracks.
    Optional character_id / lora_id bind trained weights for the session.
    """
    session = _get_or_create_session(payload.session_id)
    session["offer"] = {"type": payload.type, "sdp": payload.sdp}
    _apply_session_identity(
        session,
        character_id=payload.character_id,
        lora_id=payload.lora_id,
    )
    session["state"] = "have-remote-offer"

    # Minimal valid-looking answer SDP for negotiation plumbing tests.
    # Real media requires a media engine (aiortc / LiveKit / etc.).
    answer_sdp = _build_stub_answer_sdp(payload.sdp)
    session["answer"] = {"type": "answer", "sdp": answer_sdp}
    session["state"] = "stable"

    return SDPAnswer(
        session_id=payload.session_id,
        sdp=answer_sdp,
        type="answer",
        character_id=session.get("character_id"),
        lora_id=session.get("lora_id"),
    )


@app.post("/api/v1/webrtc/ice-candidate")
async def webrtc_ice_candidate_post(payload: IceCandidatePayload) -> dict[str, Any]:
    """Store a browser-originated ICE candidate for the session."""
    session = _get_or_create_session(payload.session_id)
    session["local_candidates"].append(payload.candidate)
    return {
        "ok": True,
        "session_id": payload.session_id,
        "count": len(session["local_candidates"]),
    }


@app.get("/api/v1/webrtc/ice-candidate")
async def webrtc_ice_candidate_get(
    session_id: str = Query(..., min_length=1),
) -> dict[str, Any]:
    """Return any server-side ICE candidates queued for the browser."""
    session = _sessions.get(session_id)
    if not session:
        return {"session_id": session_id, "candidates": []}
    # Drain remote candidates so clients don't re-apply them forever.
    candidates = list(session.get("remote_candidates") or [])
    session["remote_candidates"] = []
    return {"session_id": session_id, "candidates": candidates}


@app.get("/api/v1/webrtc/session/{session_id}")
async def webrtc_session_get(session_id: str) -> dict[str, Any]:
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="session not found")
    ice = get_settings().ice_servers()
    return {
        "session_id": session_id,
        "state": session.get("state"),
        "character_id": session.get("character_id"),
        "lora_id": session.get("lora_id"),
        "weights": session.get("weights"),
        "iceServers": ice,
        "has_offer": session.get("offer") is not None,
        "has_answer": session.get("answer") is not None,
        "local_candidate_count": len(session.get("local_candidates") or []),
    }


@app.post("/api/v1/webrtc/session")
async def webrtc_session_post(payload: SessionUpdatePayload) -> dict[str, Any]:
    """
    Create or update a WebRTC session identity.

    Accepts optional character_id and/or lora_id so the browser can hot-swap
    trained weights without renegotiating SDP.

    Always returns current STUN/TURN `iceServers` so remote peers can form
    ICE candidates beyond localhost without a separate round-trip.
    """
    session = _get_or_create_session(payload.session_id)
    _apply_session_identity(
        session,
        character_id=payload.character_id,
        lora_id=payload.lora_id,
    )
    if session.get("state") == "new" and not session.get("offer"):
        session["state"] = "ready"
    ice = get_settings().ice_servers()
    session["iceServers"] = ice
    return {
        "ok": True,
        "session_id": payload.session_id,
        "state": session.get("state"),
        "character_id": session.get("character_id"),
        "lora_id": session.get("lora_id"),
        "weights": session.get("weights"),
        "iceServers": ice,
    }


@app.post("/api/v1/webrtc/hangup")
async def webrtc_hangup(payload: HangupPayload) -> dict[str, Any]:
    session = _sessions.pop(payload.session_id, None)
    return {
        "ok": True,
        "session_id": payload.session_id,
        "existed": session is not None,
    }


@app.get("/api/v1/webrtc")
async def webrtc_root() -> dict[str, Any]:
    """List WebRTC API surface for discovery / smoke checks."""
    return {
        "service": "webrtc",
        "version": "v1",
        "endpoints": [
            "GET  /api/v1/webrtc",
            "GET  /api/v1/webrtc/ice-servers",
            "POST /api/v1/webrtc/offer",
            "POST /api/v1/webrtc/ice-candidate",
            "GET  /api/v1/webrtc/ice-candidate",
            "GET  /api/v1/webrtc/session/{session_id}",
            "POST /api/v1/webrtc/session",
            "POST /api/v1/webrtc/hangup",
        ],
        "active_sessions": len(_sessions),
    }


# ---------------------------------------------------------------------------
# Chat perform
# ---------------------------------------------------------------------------


async def _chat_perform_impl(body: ChatPerformRequest) -> ChatPerformResponse:
    """
    Accept a chat message and return a performance directive.

    LLM + video backends are selected via VIDEO_PROVIDER / LLM_PROVIDER
    through MediaBridge factories. character_id / lora_id select registry
    weights passed through to RunPod inference.
    """
    session = _get_or_create_session(body.session_id)
    # Prefer explicit body fields; fall back to session-bound identity
    character_id = body.character_id or session.get("character_id") or "default"
    lora_id = body.lora_id if body.lora_id is not None else session.get("lora_id")
    _apply_session_identity(session, character_id=character_id, lora_id=lora_id)

    session.setdefault("chat_history", []).append(
        {"role": "user", "content": body.message}
    )

    bridge = MediaBridge(get_settings())
    history = [
        {"role": h["role"], "content": h["content"]}
        for h in session.get("chat_history", [])[:-1]
        if isinstance(h, dict) and h.get("content")
    ]
    result = await bridge.perform(
        session_id=body.session_id,
        character_id=character_id,
        message=body.message,
        history=history,
        generate_video=True,
        lora_id=lora_id,
    )

    session["chat_history"].append(
        {
            "role": "assistant",
            "content": result.reply,
            "performance": result.performance,
        }
    )
    session["weights"] = result.weights

    return ChatPerformResponse(
        session_id=body.session_id,
        character_id=character_id,
        lora_id=result.lora_id,
        reply=result.reply,
        performance=result.performance,
        ok=result.ok,
        provider_llm=result.provider_llm,
        provider_video=result.provider_video,
        fallback_used=result.fallback_used,
        weights=result.weights,
    )


@app.post("/api/v1/video/generate", response_model=VideoOnlyResponse)
async def video_generate_only(body: VideoOnlyRequest) -> VideoOnlyResponse:
    """Generate a talking-head clip without a second chat completion."""
    session = _get_or_create_session(body.session_id)
    character_id = body.character_id or session.get("character_id") or "default"
    lora_id = body.lora_id if body.lora_id is not None else session.get("lora_id")
    _apply_session_identity(session, character_id=character_id, lora_id=lora_id)

    bridge = MediaBridge(get_settings())
    result = await bridge.generate_video_only(
        session_id=body.session_id,
        character_id=character_id,
        message=body.message,
        lora_id=lora_id,
    )
    return VideoOnlyResponse(
        ok=result.ok,
        session_id=body.session_id,
        character_id=character_id,
        provider=result.provider,
        video_url=result.video_url,
        job_id=result.job_id,
        duration_ms=result.duration_ms,
        fallback_used=bool(result.meta.get("fallback")),
        error=result.error,
    )


@app.post("/chat/perform", response_model=ChatPerformResponse)
async def chat_perform(body: ChatPerformRequest) -> ChatPerformResponse:
    """Legacy path kept for existing clients."""
    return await _chat_perform_impl(body)


@app.post("/api/v1/chat/perform", response_model=ChatPerformResponse)
async def chat_perform_v1(body: ChatPerformRequest) -> ChatPerformResponse:
    """Versioned chat perform with character_id / lora_id weight binding."""
    return await _chat_perform_impl(body)


# ---------------------------------------------------------------------------
# SDP helper
# ---------------------------------------------------------------------------


def _build_stub_answer_sdp(offer_sdp: str) -> str:
    """
    Build a minimal answer SDP that mirrors m-lines from the offer.

    Enough for API contract / smoke tests. Not a full media answer.
    """
    lines = [ln.strip() for ln in offer_sdp.splitlines() if ln.strip()]
    session_id = str(uuid.uuid4().int % 10**16)

    out: list[str] = [
        "v=0",
        f"o=- {session_id} 2 IN IP4 127.0.0.1",
        "s=WebRTC Stub Answer",
        "t=0 0",
    ]

    # Preserve bundle group if present
    for ln in lines:
        if ln.startswith("a=group:BUNDLE"):
            out.append(ln)
            break

    mid_index = 0
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("m="):
            # m=audio/video ... → answer with same media type, port 9 (inactive-ish)
            parts = ln.split()
            media = parts[0][2:] if parts else "application"
            # Use same payload types when available
            rest = " ".join(parts[3:]) if len(parts) > 3 else "UDP/TLS/RTP/SAVPF 111"
            out.append(f"m={media} 9 {rest}" if len(parts) > 2 else f"m={media} 9 UDP/TLS/RTP/SAVPF 111")
            out.append("c=IN IP4 0.0.0.0")
            out.append("a=rtcp:9 IN IP4 0.0.0.0")
            out.append("a=ice-ufrag:stub")
            out.append("a=ice-pwd:stubpasswordstubpassword")
            out.append("a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00")
            out.append("a=setup:active")
            out.append(f"a=mid:{mid_index}")
            out.append("a=recvonly")
            if media == "audio":
                out.append("a=rtpmap:111 opus/48000/2")
            elif media == "video":
                out.append("a=rtpmap:96 VP8/90000")
            mid_index += 1
        i += 1

    if mid_index == 0:
        # Offer had no m-lines — still return a parseable answer shell
        out.extend(
            [
                "m=audio 9 UDP/TLS/RTP/SAVPF 111",
                "c=IN IP4 0.0.0.0",
                "a=recvonly",
                "a=rtpmap:111 opus/48000/2",
            ]
        )

    return "\r\n".join(out) + "\r\n"
