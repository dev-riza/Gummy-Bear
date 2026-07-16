import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { PaginatedReadings, ReadingsFilters } from '../api/types'
import { Badge, noiseTone, tempTone } from '../components/Badge'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { formatDateTime } from '../utils/format'

const PAGE_SIZE = 15

const NOISE_OPTIONS = ['Quiet', 'Mild noise', 'Noisy', 'Very noisy']
const BRIGHTNESS_OPTIONS = ['Dark', 'Dim', 'Normal brightness', 'Bright', 'Very bright']

const MONTH_NAMES: Record<string, string> = {
  '01': 'Январь',
  '02': 'Февраль',
  '03': 'Март',
  '04': 'Апрель',
  '05': 'Май',
  '06': 'Июнь',
  '07': 'Июль',
  '08': 'Август',
  '09': 'Сентябрь',
  '10': 'Октябрь',
  '11': 'Ноябрь',
  '12': 'Декабрь',
}

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

  // Date filter is three dropdowns (day/month/year) constrained to dates that
  // actually exist in the data, rather than a free date picker where the
  // user could pick a date with no readings at all.
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [dateYear, setDateYear] = useState('')
  const [dateMonth, setDateMonth] = useState('')
  const [dateDay, setDateDay] = useState('')

  useEffect(() => {
    api
      .getAvailableDates()
      .then(setAvailableDates)
      .catch(() => setAvailableDates([]))
  }, [])

  const dateParts = useMemo(
    () =>
      availableDates.map((d) => {
        const [year, month, day] = d.split('-')
        return { year, month, day }
      }),
    [availableDates],
  )

  const years = useMemo(
    () => Array.from(new Set(dateParts.map((p) => p.year))).sort(),
    [dateParts],
  )
  const months = useMemo(
    () =>
      Array.from(new Set(dateParts.filter((p) => !dateYear || p.year === dateYear).map((p) => p.month))).sort(),
    [dateParts, dateYear],
  )
  const days = useMemo(
    () =>
      Array.from(
        new Set(
          dateParts
            .filter((p) => (!dateYear || p.year === dateYear) && (!dateMonth || p.month === dateMonth))
            .map((p) => p.day),
        ),
      ).sort(),
    [dateParts, dateYear, dateMonth],
  )

  // Auto-fill year/month when there's only one possible value, so picking a
  // day alone is enough — but this still supports multiple months/years if
  // the dataset grows, since the dropdowns are populated dynamically.
  useEffect(() => {
    if (years.length === 1 && !dateYear) setDateYear(years[0])
  }, [years, dateYear])

  useEffect(() => {
    if (months.length === 1 && !dateMonth) setDateMonth(months[0])
  }, [months, dateMonth])

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

  const applyDateParts = (year: string, month: string, day: string) => {
    if (year && month && day) {
      updateFilter({ date: `${year}-${month}-${day}` })
    } else {
      updateFilter({ date: undefined })
    }
  }

  const handleYearChange = (year: string) => {
    setDateYear(year)
    setDateMonth('')
    setDateDay('')
    applyDateParts(year, '', '')
  }

  const handleMonthChange = (month: string) => {
    setDateMonth(month)
    setDateDay('')
    applyDateParts(dateYear, month, '')
  }

  const handleDayChange = (day: string) => {
    setDateDay(day)
    applyDateParts(dateYear, dateMonth, day)
  }

  const toggleSort = (column: 'measured_at' | 'temperature') => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      order: prev.sort_by === column && prev.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))
  }

  const resetFilters = () => {
    setDateYear('')
    setDateMonth('')
    setDateDay('')
    setFilters({ sort_by: 'measured_at', order: 'desc', page: 1, page_size: PAGE_SIZE })
  }

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
            День
            <select value={dateDay} onChange={(e) => handleDayChange(e.target.value)} disabled={days.length === 0}>
              <option value="">Все</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <label>
            Месяц
            <select
              value={dateMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={months.length === 0}
            >
              <option value="">Все</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {MONTH_NAMES[m] ?? m}
                </option>
              ))}
            </select>
          </label>

          <label>
            Год
            <select value={dateYear} onChange={(e) => handleYearChange(e.target.value)} disabled={years.length === 0}>
              <option value="">Все</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
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
                        {r.temperature_status ? (
                          <Badge tone={tempTone(r.temperature_status)}>{r.temperature_status}</Badge>
                        ) : (
                          '—'
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
