"""Parses raw Telegram export messages (result.json) into structured readings."""
import re
from datetime import datetime
from typing import Optional, TypedDict

TEMP_RE = re.compile(r"(\d+(?:\.\d+)?)[^\d]{0,3}C")

BRIGHTNESS_LEVELS = ["Very bright", "Normal brightness", "Bright", "Dim", "Dark"]
NOISE_LEVELS = ["Very noisy", "Mild noise", "Noisy", "Quiet"]


class ParsedReading(TypedDict):
    measured_at: datetime
    location: str
    temperature: float
    brightness: Optional[str]
    noise: Optional[str]


def _first_match(text: str, candidates: list[str]) -> Optional[str]:
    for candidate in candidates:
        if candidate in text:
            return candidate
    return None


def parse_message_text(text: str) -> Optional[dict]:
    """Extracts location/temperature/brightness/noise from one message's text.

    Returns None if the message doesn't look like a sensor reading.
    """
    if "Outside" in text:
        location = "outside"
    elif "Atrium" in text:
        location = "atrium"
    else:
        return None

    temp_match = TEMP_RE.search(text)
    if not temp_match:
        return None
    temperature = float(temp_match.group(1))

    brightness = _first_match(text, BRIGHTNESS_LEVELS) if location == "atrium" else None
    noise = _first_match(text, NOISE_LEVELS) if location == "atrium" else None

    return {
        "location": location,
        "temperature": temperature,
        "brightness": brightness,
        "noise": noise,
    }


def parse_export(export: dict) -> list[ParsedReading]:
    readings: list[ParsedReading] = []
    for message in export.get("messages", []):
        if message.get("type") != "message":
            continue
        text = message.get("text")
        if not isinstance(text, str):
            continue
        parsed = parse_message_text(text)
        if parsed is None:
            continue
        measured_at = datetime.fromisoformat(message["date"])
        readings.append(
            {
                "measured_at": measured_at,
                "location": parsed["location"],
                "temperature": parsed["temperature"],
                "brightness": parsed["brightness"],
                "noise": parsed["noise"],
            }
        )
    return readings
