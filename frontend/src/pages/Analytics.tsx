import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import type { ReadingWithStatus, SummaryOut } from '../api/types'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { formatDateLabel, formatTemp, formatTime } from '../utils/format'

interface ChartPoint {
  time: string
  sortKey: number
  atrium?: number
  outside?: number
}

function buildChartData(readings: ReadingWithStatus[]): ChartPoint[] {
  const points = readings
    .slice()
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
    .map((r) => ({
      time: formatTime(r.measured_at),
      sortKey: new Date(r.measured_at).getTime(),
      location: r.location,
      temperature: r.temperature,
    }))

  const merged: ChartPoint[] = []
  for (const p of points) {
    merged.push({
      time: p.time,
      sortKey: p.sortKey,
      atrium: p.location === 'atrium' ? p.temperature : undefined,
      outside: p.location === 'outside' ? p.temperature : undefined,
    })
  }
  return merged
}

export function Analytics() {
  const [dates, setDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)
  const [summary, setSummary] = useState<SummaryOut | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getAvailableDates()
      .then((ds) => {
        setDates(ds)
        setSelectedDate((prev) => prev ?? ds[ds.length - 1])
      })
      .catch(() => setError('Не удалось загрузить список дат.'))
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getSummary(selectedDate),
      api.getReadings({ date: selectedDate, page_size: 300, sort_by: 'measured_at', order: 'asc' }),
    ])
      .then(([summaryRes, readingsRes]) => {
        setSummary(summaryRes)
        setChartData(buildChartData(readingsRes.items))
      })
      .catch(() => setError('Не удалось загрузить аналитику за этот день.'))
      .finally(() => setLoading(false))
  }, [selectedDate])

  return (
    <>
      <div className="page-header">
        <h1>Аналитика</h1>
        <p>Статистика и собственные аналитические выводы за выбранный день.</p>
      </div>

      {dates.length > 0 && (
        <div className="day-switcher">
          {dates.map((d) => (
            <button
              key={d}
              className={`day-chip${selectedDate === d ? ' active' : ''}`}
              onClick={() => setSelectedDate(d)}
            >
              {formatDateLabel(d)}
            </button>
          ))}
        </div>
      )}

      {loading && <LoadingState label="Считаем показатели дня…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => setSelectedDate(selectedDate)} />}
      {!loading && !error && !summary && <EmptyState message="Нет данных для аналитики." />}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
            <div className="stat-card">
              <div className="label">Температура в атриуме</div>
              <div className="value">{formatTemp(summary.atrium_temperature.avg)}</div>
              <div className="sub">
                мин {formatTemp(summary.atrium_temperature.min)} · макс{' '}
                {formatTemp(summary.atrium_temperature.max)} · {summary.atrium_temperature.count} измерений
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Температура на улице</div>
              <div className="value">{formatTemp(summary.outside_temperature.avg)}</div>
              <div className="sub">
                мин {formatTemp(summary.outside_temperature.min)} · макс{' '}
                {formatTemp(summary.outside_temperature.max)} · {summary.outside_temperature.count} измерений
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="section-title">Температура внутри и снаружи в течение дня</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} minTickGap={24} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  unit="°C"
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip
                  formatter={(value, name) => [`${Number(value).toFixed(1)}°C`, String(name)]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="atrium"
                  name="Атриум"
                  stroke="#c9982a"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="outside"
                  name="Улица"
                  stroke="#5b7fbf"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="section-title">Собственные аналитические выводы</div>
            <div className="insights-list">
              {summary.insights.map((insight) => (
                <div key={insight.label} className="insight-item">
                  <div className="label">{insight.label}</div>
                  <div className="value">{insight.value}</div>
                  {insight.detail && <div className="detail">{insight.detail}</div>}
                </div>
              ))}
              {summary.average_comfort_score !== null && (
                <div className="insight-item">
                  <div className="label">Средний comfort score</div>
                  <div className="value">{summary.average_comfort_score}/100</div>
                  <div className="detail">по собственной формуле (см. README)</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
