import type {
  CurrentState,
  PaginatedReadings,
  ReadingWithStatus,
  ReadingsFilters,
  ReportCategory,
  ReportOut,
  ReportStatus,
  SummaryOut,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function buildQuery(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export const api = {
  getCurrent: () => request<CurrentState>('/api/current'),

  getReadings: (filters: ReadingsFilters) =>
    request<PaginatedReadings>(`/api/readings${buildQuery(filters)}`),

  getReading: (id: number) => request<ReadingWithStatus>(`/api/readings/${id}`),

  getReadingsCsvUrl: (filters: ReadingsFilters) =>
    `${API_BASE}/api/readings/export${buildQuery(filters)}`,

  getSummary: (date?: string) => request<SummaryOut>(`/api/summary${buildQuery({ date })}`),

  getAvailableDates: () => request<string[]>('/api/summary/available-dates'),

  listReports: (status?: ReportStatus) =>
    request<ReportOut[]>(`/api/reports${buildQuery({ status })}`),

  createReport: (payload: { category: ReportCategory; comment?: string }) =>
    request<ReportOut>('/api/reports', { method: 'POST', body: JSON.stringify(payload) }),

  updateReport: (
    id: number,
    payload: Partial<{ category: ReportCategory; comment: string; status: ReportStatus }>,
  ) => request<ReportOut>(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteReport: (id: number) => request<void>(`/api/reports/${id}`, { method: 'DELETE' }),
}
