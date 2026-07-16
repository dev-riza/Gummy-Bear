import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { PaginatedReadings, ReadingsFilters } from '../api/types'
import { Badge, noiseTone, tempTone } from '../components/Badge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { formatDateTime } from '../utils/format'

const PAGE_SIZE = 15

const NOISE_OPTIONS = ['Quiet', 'Mild noise', 'Noisy', 'Very noisy']
const BRIGHTNESS_OPTIONS = ['Dark', 'Dim', 'Normal brightness', 'Bright', 'Very bright']

export function History() {
  const [filters, setFilters] = useState<ReadingsFilters>({
    sort_by: 'measured_at',
    order: 'desc',
    page: 1,
    page_size: PAGE_SIZE,
  })
  const [data, setData] = useState<PaginatedReadings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (f: ReadingsFilters) => {
    setLoading(true)
    setError(null)
    api
      .getReadings(f)
      .then(setData)
      .catch(() => setError('Не удалось загрузить историю измерений.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => load(filters), [filters])

  const updateFilter = (patch: Partial<ReadingsFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }))
  }

  const toggleSort = (column: 'measured_at' | 'temperature') => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      order: prev.sort_by === column && prev.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))
  }

  const resetFilters = () =>
    setFilters({ sort_by: 'measured_at', order: 'desc', page: 1, page_size: PAGE_SIZE })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const sortIndicator = (column: string) =>
    filters.sort_by === column ? (filters.order === 'asc' ? '▲' : '▼') : ''

  return (
    <>
      <div className="page-header">
        <h1>История измерений</h1>
        <p>Все показания датчиков с фильтрацией и сортировкой.</p>
      </div>

      <div className="card">
        <div className="filters-bar">
          <label>
            Дата
            <input
              type="date"
              value={filters.date ?? ''}
              onChange={(e) => updateFilter({ date: e.target.value || undefined })}
            />
          </label>

          <label>
            Место
            <select
              value={filters.location ?? ''}
              onChange={(e) =>
                updateFilter({ location: (e.target.value || undefined) as 'atrium' | 'outside' | undefined })
              }
            >
              <option value="">Все</option>
              <option value="atrium">Атриум</option>
              <option value="outside">Улица</option>
            </select>
          </label>

          <label>
            Шум
            <select
              value={filters.noise ?? ''}
              onChange={(e) => updateFilter({ noise: e.target.value || undefined })}
            >
              <option value="">Все</option>
              {NOISE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label>
            Освещение
            <select
              value={filters.brightness ?? ''}
              onChange={(e) => updateFilter({ brightness: e.target.value || undefined })}
            >
              <option value="">Все</option>
              {BRIGHTNESS_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label>
            Темп. от
            <input
              type="number"
              step="0.1"
              value={filters.temp_min ?? ''}
              onChange={(e) =>
                updateFilter({ temp_min: e.target.value ? Number(e.target.value) : undefined })
              }
              style={{ width: '5rem' }}
            />
          </label>

          <label>
            Темп. до
            <input
              type="number"
              step="0.1"
              value={filters.temp_max ?? ''}
              onChange={(e) =>
                updateFilter({ temp_max: e.target.value ? Number(e.target.value) : undefined })
              }
              style={{ width: '5rem' }}
            />
          </label>

          <button className="btn" onClick={resetFilters}>
            Сбросить
          </button>

          <a className="btn btn-primary" href={api.getReadingsCsvUrl(filters)} style={{ marginLeft: 'auto' }}>
            Экспорт CSV
          </a>
        </div>

        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} onRetry={() => load(filters)} />}
        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState
            message="Нет измерений по заданным фильтрам."
            hint="Попробуйте изменить дату или сбросить фильтры."
          />
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button onClick={() => toggleSort('measured_at')}>
                        Время {sortIndicator('measured_at')}
                      </button>
                    </th>
                    <th>Место</th>
                    <th>
                      <button onClick={() => toggleSort('temperature')}>
                        Температура {sortIndicator('temperature')}
                      </button>
                    </th>
                    <th>Освещение</th>
                    <th>Шум</th>
                    <th>Comfort score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.measured_at)}</td>
                      <td>{r.location === 'atrium' ? 'Атриум' : 'Улица'}</td>
                      <td>
                        {r.temperature.toFixed(1)}°C{' '}
                        {r.temperature_status && (
                          <Badge tone={tempTone(r.temperature_status)}>{r.temperature_status}</Badge>
                        )}
                      </td>
                      <td>{r.brightness_status ?? '—'}</td>
                      <td>
                        {r.noise_status ? (
                          <Badge tone={noiseTone(r.noise_status)}>{r.noise_status}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{r.comfort_score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={filters.page === 1}
                onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
              >
                ← Назад
              </button>
              <span>
                Страница {data.page} из {totalPages} ({data.total} измерений)
              </span>
              <button
                className="btn btn-sm"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
              >
                Вперёд →
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
