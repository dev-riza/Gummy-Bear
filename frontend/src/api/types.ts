export type Location = 'atrium' | 'outside'

export type ReportCategory =
  | 'too_hot'
  | 'too_noisy'
  | 'too_bright'
  | 'too_dark'
  | 'comfortable'
  | 'other'

export type ReportStatus = 'open' | 'resolved'

export interface ReadingOut {
  id: number
  measured_at: string
  location: Location
  temperature: number
  brightness: string | null
  noise: string | null
}

export interface ReadingWithStatus extends ReadingOut {
  temperature_status: string | null
  noise_status: string | null
  brightness_status: string | null
  comfort_score: number | null
}

export interface CurrentState {
  atrium: ReadingWithStatus | null
  outside: ReadingOut | null
  indoor_outdoor_diff: number | null
  overall_status: string
  recommendation: string
}

export interface DailyStat {
  min: number | null
  max: number | null
  avg: number | null
  count: number
}

export interface Insight {
  label: string
  value: string
  detail: string | null
}

export interface SummaryOut {
  date: string
  atrium_temperature: DailyStat
  outside_temperature: DailyStat
  indoor_outdoor_avg_diff: number | null
  uncomfortable_readings: number
  average_comfort_score: number | null
  insights: Insight[]
}

export interface PaginatedReadings {
  items: ReadingWithStatus[]
  total: number
  page: number
  page_size: number
}

export interface ReportOut {
  id: number
  created_at: string
  category: ReportCategory
  comment: string | null
  status: ReportStatus
}

export interface ReadingsFilters {
  date?: string
  location?: Location
  noise?: string
  brightness?: string
  temp_min?: number
  temp_max?: number
  sort_by?: 'measured_at' | 'temperature'
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  too_hot: 'Слишком жарко',
  too_noisy: 'Слишком шумно',
  too_bright: 'Слишком ярко',
  too_dark: 'Слишком темно',
  comfortable: 'Комфортно',
  other: 'Другое',
}
