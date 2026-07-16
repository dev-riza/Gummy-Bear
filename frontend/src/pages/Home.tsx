import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { CurrentState } from '../api/types'
import { Badge, noiseTone, tempTone } from '../components/Badge'
import { ErrorState, LoadingState } from '../components/States'
import { formatDateTime, formatTemp } from '../utils/format'

function scoreTone(score: number | null): 'good' | 'warn' | 'bad' {
  if (score === null) return 'warn'
  if (score >= 75) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

export function Home() {
  const [state, setState] = useState<CurrentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .getCurrent()
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

  return (
    <>
      <div className="page-header">
        <h1>Текущее состояние атриума</h1>
        <p>Свежие показания датчиков и рекомендация — стоит ли идти в атриум прямо сейчас.</p>
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

      {!loading && !error && state && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div className="section-title">Рекомендация</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{state.recommendation}</div>
                {state.atrium && (
                  <p className="helper-text">
                    Обновлено {formatDateTime(state.atrium.measured_at)}
                  </p>
                )}
              </div>
              <Badge tone={tempTone(state.overall_status)}>{state.overall_status}</Badge>
            </div>
          </div>

          <div className="grid grid-4">
            <div className="stat-card">
              <div className="label">Атриум</div>
              <div className="value">{formatTemp(state.atrium?.temperature)}</div>
              {state.atrium?.comfort_score !== undefined && state.atrium?.comfort_score !== null && (
                <div className="sub">
                  <Badge tone={scoreTone(state.atrium.comfort_score)}>
                    comfort score {state.atrium.comfort_score}/100
                  </Badge>
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="label">На улице</div>
              <div className="value">{formatTemp(state.outside?.temperature)}</div>
              {state.indoor_outdoor_diff !== null && (
                <div className="sub">
                  {state.indoor_outdoor_diff >= 0 ? '+' : ''}
                  {state.indoor_outdoor_diff.toFixed(1)}°C относительно улицы
                </div>
              )}
            </div>

            <div className="stat-card">
              <div className="label">Освещение</div>
              <div className="value" style={{ fontSize: '1.15rem' }}>
                {state.atrium?.brightness_status ?? '—'}
              </div>
            </div>

            <div className="stat-card">
              <div className="label">Шум</div>
              <div className="value" style={{ fontSize: '1.15rem' }}>
                {state.atrium?.noise_status ?? '—'}
              </div>
              {state.atrium?.noise_status && (
                <div className="sub">
                  <Badge tone={noiseTone(state.atrium.noise_status)}>
                    {state.atrium.noise_status}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
