import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { CurrentState, EventOut, ReadingOut, ReadingWithStatus } from '../api/types'
import { Badge, tempTone } from '../components/Badge'
import { Foku, type FokuMood } from '../components/Foku'
import { ErrorState, LoadingState } from '../components/States'
import { useToast } from '../context/ToastContext'
import { formatDateTime, formatTemp, formatTime } from '../utils/format'
import { getOrCreateVisitorId } from '../utils/visitor'

const EVENT_POLL_MS = 60000

function scoreTone(score: number | null): 'good' | 'warn' | 'bad' {
  if (score === null) return 'warn'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

const SCORE_COLOR: Record<'good' | 'warn' | 'bad', string> = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
}

// --- Test-mode random data generator ---------------------------------------
// Cycles deterministically through all four Foku moods (excellent -> normal
// -> poor -> friend -> repeat) every 30s, rather than drawing independent
// random data each tick — independent draws could land on the same mood
// several times in a row, which reads as "the mascot isn't changing" even
// though the underlying logic is fine. Purely client-side and clearly
// labeled in the UI so it's never mistaken for a real reading.
const DEMO_INTERVAL_MS = 30000
const DEMO_MOOD_SEQUENCE: FokuMood[] = ['excellent', 'normal', 'poor', 'friend']

const BRIGHTNESS_LEVELS = ['Dark', 'Dim', 'Normal brightness', 'Bright', 'Very bright']
const BRIGHTNESS_RU: Record<string, string> = {
  Dark: 'Темно',
  Dim: 'Приглушённый свет',
  'Normal brightness': 'Обычное освещение',
  Bright: 'Ярко',
  'Very bright': 'Очень ярко',
}
const NOISE_LEVELS = ['Quiet', 'Mild noise', 'Noisy', 'Very noisy']
const NOISE_RU: Record<string, string> = {
  Quiet: 'Тихо',
  'Mild noise': 'Умеренный шум',
  Noisy: 'Шумно',
  'Very noisy': 'Очень шумно',
}

// --- Personal preference picker --------------------------------------------
// Lets a visitor pick their own idea of ideal temperature/noise/brightness,
// saved to the database under an anonymous per-browser visitor ID (see
// utils/visitor.ts). Once saved, the backend uses it to personalize
// comfort_score (and therefore Foku's mood) for that visitor specifically.

interface PreferenceCheck {
  label: string
  match: boolean
  note: string
}

function comparePreferences(
  atrium: ReadingWithStatus,
  preferredTemp: number,
  preferredNoise: string,
  preferredBrightness: string,
): PreferenceCheck[] {
  const tempDiff = atrium.temperature - preferredTemp
  const tempMatch = Math.abs(tempDiff) <= 2
  const tempNote = tempMatch
    ? 'как вы любите'
    : tempDiff > 0
      ? `на ${tempDiff.toFixed(1)}°C теплее, чем вы предпочитаете`
      : `на ${Math.abs(tempDiff).toFixed(1)}°C холоднее, чем вы предпочитаете`

  const noiseIdx = NOISE_LEVELS.indexOf(atrium.noise ?? 'Mild noise')
  const preferredNoiseIdx = NOISE_LEVELS.indexOf(preferredNoise)
  const noiseMatch = noiseIdx <= preferredNoiseIdx
  const noiseNote = noiseMatch ? 'тише или так же, как вы любите' : 'шумнее, чем вы предпочитаете'

  const brightnessIdx = BRIGHTNESS_LEVELS.indexOf(atrium.brightness ?? 'Normal brightness')
  const preferredBrightnessIdx = BRIGHTNESS_LEVELS.indexOf(preferredBrightness)
  const brightnessMatch = Math.abs(brightnessIdx - preferredBrightnessIdx) <= 1
  const brightnessNote = brightnessMatch ? 'совпадает с вашим выбором' : 'отличается от вашего выбора'

  return [
    { label: `Температура: ${atrium.temperature.toFixed(1)}°C`, match: tempMatch, note: tempNote },
    { label: `Шум: ${atrium.noise_status ?? '—'}`, match: noiseMatch, note: noiseNote },
    { label: `Освещение: ${atrium.brightness_status ?? '—'}`, match: brightnessMatch, note: brightnessNote },
  ]
}

function demoTemperatureStatus(temp: number): string {
  if (temp < 16) return 'Холодно'
  if (temp <= 23) return 'Комфортно'
  if (temp <= 27) return 'Тепло'
  return 'Жарко'
}

// Generates data guaranteed to land in the requested mood, matching Foku's
// own priority order (poor beats friend beats excellent beats normal).
function randomDataForMood(mood: FokuMood): { score: number; noise: string } {
  const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min))
  switch (mood) {
    case 'excellent':
      return { score: rand(80, 100), noise: Math.random() < 0.5 ? 'Quiet' : 'Mild noise' }
    case 'normal':
      return { score: rand(50, 79), noise: Math.random() < 0.5 ? 'Quiet' : 'Mild noise' }
    case 'poor':
      return {
        score: rand(0, 49),
        noise: ['Quiet', 'Mild noise', 'Noisy', 'Very noisy'][Math.floor(Math.random() * 4)],
      }
    case 'friend':
      return { score: rand(50, 100), noise: Math.random() < 0.5 ? 'Noisy' : 'Very noisy' }
  }
}

function randomDemoState(mood: FokuMood): CurrentState {
  const { score, noise } = randomDataForMood(mood)
  const brightness = BRIGHTNESS_LEVELS[Math.floor(Math.random() * BRIGHTNESS_LEVELS.length)]
  const temperature = Math.round((18 + Math.random() * 20) * 10) / 10
  const outsideTemperature = Math.round((12 + Math.random() * 28) * 10) / 10
  const now = new Date().toISOString()

  const atrium: ReadingWithStatus = {
    id: -1,
    measured_at: now,
    location: 'atrium',
    temperature,
    brightness,
    noise,
    temperature_status: demoTemperatureStatus(temperature),
    noise_status: NOISE_RU[noise],
    brightness_status: BRIGHTNESS_RU[brightness],
    comfort_score: score,
  }
  const outside: ReadingOut = {
    id: -2,
    measured_at: now,
    location: 'outside',
    temperature: outsideTemperature,
    brightness: null,
    noise: null,
  }
  const quietEnough = noise === 'Quiet' || noise === 'Mild noise'

  return {
    atrium,
    outside,
    indoor_outdoor_diff: Math.round((temperature - outsideTemperature) * 10) / 10,
    overall_status: demoTemperatureStatus(temperature),
    recommendation: temperature <= 29 && quietEnough ? 'Подходит для учёбы' : 'Лучше выбрать другое место',
    personalized: false,
  }
}

export function Home() {
  const { showToast } = useToast()
  const [state, setState] = useState<CurrentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const demoInterval = useRef<number | null>(null)
  const demoIndex = useRef(0)
  const [activeEvent, setActiveEvent] = useState<EventOut | null>(null)
  const [showScoreDetails, setShowScoreDetails] = useState(false)
  const visitorId = useRef(getOrCreateVisitorId())
  const [preferredTemp, setPreferredTemp] = useState(22)
  const [preferredNoise, setPreferredNoise] = useState('Mild noise')
  const [preferredBrightness, setPreferredBrightness] = useState('Normal brightness')
  const [savingPreference, setSavingPreference] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .getCurrent(visitorId.current)
      .then(setState)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setState(null)
        } else {
          setError('Не удалось загрузить текущее состояние атриума.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Pull this visitor's previously saved preference (if any) from the
  // database so the sliders reflect what they chose last time, not just a
  // blank default.
  useEffect(() => {
    api
      .getPreference(visitorId.current)
      .then((pref) => {
        setPreferredTemp(pref.preferred_temp)
        setPreferredNoise(pref.preferred_noise)
        setPreferredBrightness(pref.preferred_brightness)
      })
      .catch(() => {
        // No saved preference yet — keep the defaults.
      })
  }, [])

  const savePreference = () => {
    setSavingPreference(true)
    api
      .savePreference(visitorId.current, {
        preferred_temp: preferredTemp,
        preferred_noise: preferredNoise,
        preferred_brightness: preferredBrightness,
      })
      .then(() => {
        showToast('Предпочтения сохранены — comfort score теперь ваш личный.')
        load()
      })
      .catch(() => showToast('Не удалось сохранить предпочтения.', 'error'))
      .finally(() => setSavingPreference(false))
  }

  useEffect(() => {
    const loadEvent = () => {
      api
        .getActiveEvent()
        .then(setActiveEvent)
        .catch(() => setActiveEvent(null))
    }
    loadEvent()
    const interval = window.setInterval(loadEvent, EVENT_POLL_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!demoMode) return

    const tick = () => {
      const mood = DEMO_MOOD_SEQUENCE[demoIndex.current % DEMO_MOOD_SEQUENCE.length]
      demoIndex.current += 1
      setState(randomDemoState(mood))
    }

    tick()
    demoInterval.current = window.setInterval(tick, DEMO_INTERVAL_MS)
    return () => {
      if (demoInterval.current !== null) {
        window.clearInterval(demoInterval.current)
        demoInterval.current = null
      }
    }
  }, [demoMode])

  const toggleDemoMode = () => {
    setDemoMode((prev) => {
      const next = !prev
      if (!next) load()
      return next
    })
  }

  return (
    <>
      {activeEvent && (
        <div className="event-banner">
          {activeEvent.status === 'ongoing' ? (
            <>
              🎉 Сейчас в атриуме: <strong>{activeEvent.title}</strong> (до{' '}
              {formatTime(activeEvent.end_time)})
            </>
          ) : (
            <>
              📅 Скоро в атриуме: <strong>{activeEvent.title}</strong> в{' '}
              {formatTime(activeEvent.start_time)}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button className="btn btn-sm" onClick={toggleDemoMode}>
          {demoMode ? 'Остановить тестовый режим' : 'Тестовый режим: смена настроения каждые 30 сек'}
        </button>
        {demoMode && (
          <span className="helper-text" style={{ margin: 0 }}>
            ⚠️ Показаны случайные тестовые данные, не реальные показания датчиков.
          </span>
        )}
      </div>

      {loading && <LoadingState label="Загружаем последние показания…" />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && !state && (
        <div className="card">
          <div className="state-block">
            <div className="icon">📭</div>
            <p>Пока нет ни одного измерения. Запустите импорт данных на backend.</p>
          </div>
        </div>
      )}

      {!loading && !error && state && (() => {
        const atrium = state.atrium
        return (
        <>
          <div className="card mascot-hero">
            <Foku score={state.atrium?.comfort_score ?? null} noise={state.atrium?.noise ?? null} />
            <div className="mascot-hero-info">
              <Badge tone={tempTone(state.overall_status)}>{state.overall_status}</Badge>
              <div className="mascot-hero-recommendation">{state.recommendation}</div>
              {state.atrium && (
                <p className="helper-text">Обновлено {formatDateTime(state.atrium.measured_at)}</p>
              )}
              <p className="helper-text mascot-hero-hint">
                Наведите курсор на Foku, чтобы он повернулся к вам, или нажмите — он отреагирует на
                текущие условия в атриуме.
              </p>
            </div>
          </div>

          {atrium && atrium.comfort_score !== null && (
            <div className="comfort-score-wrap">
              <div
                className="comfort-score-bubble"
                style={{ borderColor: SCORE_COLOR[scoreTone(atrium.comfort_score)] }}
              >
                <span className="comfort-score-label">
                  {state.personalized ? '🎯 Ваш comfort score' : 'Comfort score'}
                </span>
                <span
                  className="comfort-score-value"
                  style={{ color: SCORE_COLOR[scoreTone(atrium.comfort_score)] }}
                >
                  {atrium.comfort_score}/100
                </span>
                <button
                  type="button"
                  className="comfort-score-expand"
                  onClick={() => setShowScoreDetails((v) => !v)}
                  aria-expanded={showScoreDetails}
                  aria-label="Выбрать свои идеальные условия"
                >
                  {showScoreDetails ? '−' : '+'}
                </button>
              </div>

              {showScoreDetails && (
                <div className="comfort-score-details">
                  <p>Выберите свои идеальные условия — и узнайте, подходит ли атриум именно вам:</p>

                  <div className="preference-picker">
                    <label className="preference-row">
                      <span>Идеальная температура: {preferredTemp}°C</span>
                      <input
                        type="range"
                        min={14}
                        max={36}
                        step={1}
                        value={preferredTemp}
                        onChange={(e) => setPreferredTemp(Number(e.target.value))}
                      />
                    </label>

                    <label className="preference-row">
                      <span>Комфортный уровень шума</span>
                      <select value={preferredNoise} onChange={(e) => setPreferredNoise(e.target.value)}>
                        {NOISE_LEVELS.map((n) => (
                          <option key={n} value={n}>
                            {NOISE_RU[n]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="preference-row">
                      <span>Комфортное освещение</span>
                      <select
                        value={preferredBrightness}
                        onChange={(e) => setPreferredBrightness(e.target.value)}
                      >
                        {BRIGHTNESS_LEVELS.map((b) => (
                          <option key={b} value={b}>
                            {BRIGHTNESS_RU[b]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={savePreference}
                      disabled={savingPreference}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {savingPreference ? 'Сохраняем…' : 'Сохранить предпочтения'}
                    </button>
                  </div>

                  <div className="preference-result">
                    <p>Сейчас в атриуме:</p>
                    <ul>
                      {comparePreferences(atrium, preferredTemp, preferredNoise, preferredBrightness).map(
                        (check) => (
                          <li key={check.label} className={check.match ? 'match' : 'mismatch'}>
                            {check.match ? '✅' : '⚠️'} {check.label} — {check.note}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-4">
            <div className="stat-card accent-temp">
              <div className="label">🌡️ Атриум</div>
              <div className="value">{formatTemp(state.atrium?.temperature)}</div>
            </div>

            <div className="stat-card accent-sky">
              <div className="label">🌤️ На улице</div>
              <div className="value">{formatTemp(state.outside?.temperature)}</div>
              {state.indoor_outdoor_diff !== null && (
                <div className="sub">
                  {state.indoor_outdoor_diff >= 0 ? '+' : ''}
                  {state.indoor_outdoor_diff.toFixed(1)}°C относительно улицы
                </div>
              )}
            </div>

            <div className="stat-card accent-light">
              <div className="label">💡 Освещение</div>
              <div className="value" style={{ fontSize: '1.15rem' }}>
                {state.atrium?.brightness_status ?? '—'}
              </div>
            </div>

            <div className="stat-card accent-sound">
              <div className="label">🔊 Шум</div>
              <div className="value" style={{ fontSize: '1.15rem' }}>
                {state.atrium?.noise_status ?? '—'}
              </div>
            </div>
          </div>
        </>
        )
      })()}
    </>
  )
}
