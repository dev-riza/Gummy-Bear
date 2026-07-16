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
    if temp < 20:
        return "Прохладно"
    if temp < 27:
        return "Комфортно"
    if temp < 30:
        return "Тепло"
    if temp < 33:
        return "Жарко"
    return "Очень жарко"


def noise_status(noise: Optional[str]) -> Optional[str]:
    if noise is None:
        return None
    return NOISE_RU.get(noise, noise)


def brightness_status(brightness: Optional[str]) -> Optional[str]:
    if brightness is None:
        return None
    return BRIGHTNESS_RU.get(brightness, brightness)


def comfort_score(temp: float, noise: Optional[str], brightness: Optional[str]) -> int:
    """0-100 score: 100 is ideal (~24-27C, quiet, normal brightness)."""
    score = 100.0

    if temp < 20:
        score -= (20 - temp) * 4
    elif temp <= 27:
        pass
    elif temp <= 30:
        score -= (temp - 27) * 5
    elif temp <= 33:
        score -= 15 + (temp - 30) * 7
    else:
        score -= 36 + (temp - 33) * 10

    score -= _NOISE_PENALTY.get(noise, 15) if noise else 0
    score -= _BRIGHTNESS_PENALTY.get(brightness, 10) if brightness else 0

    return max(0, min(100, round(score)))


def is_comfortable(temp: float, noise: Optional[str], brightness: Optional[str]) -> bool:
    return comfort_score(temp, noise, brightness) >= 60


def study_recommendation(temp: float, noise: Optional[str]) -> str:
    quiet_enough = noise in ("Quiet", "Mild noise") if noise else True
    if temp <= 29 and quiet_enough:
        return "Подходит для учёбы"
    return "Лучше выбрать другое место"
