"""Video generation providers (mock + RunPod MuseTalk)."""

from app.services.video.base import VideoGenerateRequest, VideoGenerateResult, VideoProvider
from app.services.video.factory import get_video_provider

__all__ = [
    "VideoGenerateRequest",
    "VideoGenerateResult",
    "VideoProvider",
    "get_video_provider",
]
