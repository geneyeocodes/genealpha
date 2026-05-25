from youtube_transcript_api import YouTubeTranscriptApi
import re


def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"(?:embed/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Could not extract video ID from URL: {url}")


def get_transcript(url: str, language: str = "en") -> str:
    video_id = extract_video_id(url)
    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
    return " ".join([entry["text"] for entry in transcript])
