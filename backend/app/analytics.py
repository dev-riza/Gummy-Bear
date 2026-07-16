"""Comfort scoring and analytical rules.

All thresholds below are the app's own editorial judgment calls (not medical or
safety guidance) chosen to fit the observed data range (indoor ~27-33C,
outdoor ~19-38C). They are documented in README.md as well.
"""
from typing import Optional

NOISE_RU = {
    "Quiet": "Тихо",
    "Mild noise": "Умеренный шум",
    "Noisy": "Шумно",
    "Very noisy": "Очень шумно",
}

BRIGHTNESS_RU = {
    "Dark": "Темно",
    "Dim": "Приглушённый свет",
    "Normal brightness": "Обычное освещение",
    "Bright": "Ярко",
    "Very bright": "Очень ярко",
}

_NOISE_PENALTY = {"Quiet": 0, "Mild noise": 10, "Noisy": 25, "Very noisy": 40}
_BRIGHTNESS_PENALTY = {
    "Normal brightness": 0,
    "Bright": 5,
    "Dim": 8,
    "Dark": 15,
    "Very bright": 15,
}


def temperature_status(temp: float) -> str:
    if temp < 16:
        return "Холодно"
    if temp <= 23:
        return "Комфортно"
    if temp <= 27:
        return "Тепло"
    return "Жарко"


def noise_status(noise: Optional[str]) -> Optional[str]:
    if noise is None:
        return None
    return NOISE_RU.get(noise, noise)


def brightness_status(brightness: Optional[str]) -> Optional[str]:
    if brightness is None:
        return None
    return BRIGHTNESS_RU.get(brightness, brightness)


def comfort_score(temp: float, noise: Optional[str], brightness: Optional[str]) -> int:
    """0-100 score: 100 is ideal (16-23C, quiet, normal brightness).

    Mirrors the temperature_status() bands (Холодно/Комфортно/Тепло/Жарко) so
    the numeric score and the text label never disagree about the same
    reading.
    """
    score = 100.0

    if temp < 16:
        score -= (16 - temp) * 4
    elif temp <= 23:
        pass
    elif temp <= 27:
        score -= (temp - 23) * 5
    else:
        score -= 20 + (temp - 27) * 8

    score -= _NOISE_PENALTY.get(noise, 15) if noise else 0
    score -= _BRIGHTNESS_PENALTY.get(brightness, 10) if brightness else 0

    return max(0, min(100, round(score)))


def is_comfortable(temp: float, noise: Optional[str], brightness: Optional[str]) -> bool:
    return comfort_score(temp, noise, brightness) >= 60


_NOISE_ORDER = ["Quiet", "Mild noise", "Noisy", "Very noisy"]
_BRIGHTNESS_ORDER = ["Dark", "Dim", "Normal brightness", "Bright", "Very bright"]


def personalized_comfort_score(
    temp: float,
    noise: Optional[str],
    brightness: Optional[str],
    preferred_temp: float,
    preferred_noise: str,
    preferred_brightness: str,
) -> int:
    """Same 0-100 shape as comfort_score(), but centered on one visitor's own
    saved idea of ideal conditions instead of the app's fixed definition.

    - Temperature: no penalty within +/-2C of their preference, then scales up.
    - Noise/brightness: penalty only grows the further the reading is from
      their preferred level, in either direction (going quieter/dimmer than
      preferred costs nothing — only louder/brighter than desired, and vice
      versa for brightness where either direction away from preference costs).
    """
    score = 100.0

    temp_diff = abs(temp - preferred_temp)
    if temp_diff > 2:
        score -= (temp_diff - 2) * 6

    if noise:
        noise_idx = _NOISE_ORDER.index(noise) if noise in _NOISE_ORDER else 2
        preferred_idx = _NOISE_ORDER.index(preferred_noise) if preferred_noise in _NOISE_ORDER else 1
        if noise_idx > preferred_idx:
            score -= (noise_idx - preferred_idx) * 15

    if brightness:
        b_idx = _BRIGHTNESS_ORDER.index(brightness) if brightness in _BRIGHTNESS_ORDER else 2
        preferred_b_idx = (
            _BRIGHTNESS_ORDER.index(preferred_brightness) if preferred_brightness in _BRIGHTNESS_ORDER else 2
        )
        score -= abs(b_idx - preferred_b_idx) * 10

    return max(0, min(100, round(score)))


def study_recommendation(temp: float, noise: Optional[str]) -> str:
    quiet_enough = noise in ("Quiet", "Mild noise") if noise else True
    if temp <= 29 and quiet_enough:
        return "Подходит для учёбы"
    return "Лучше выбрать другое место"
