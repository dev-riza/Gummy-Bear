type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral'

const TEMP_TONE: Record<string, BadgeTone> = {
  Холодно: 'warn',
  Комфортно: 'good',
  Тепло: 'warn',
  Жарко: 'bad',
}

const NOISE_TONE: Record<string, BadgeTone> = {
  Тихо: 'good',
  'Умеренный шум': 'warn',
  Шумно: 'bad',
  'Очень шумно': 'bad',
}

export function tempTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral'
  return TEMP_TONE[status] ?? 'neutral'
}

export function noiseTone(status: string | null | undefined): BadgeTone {
  if (!status) return 'neutral'
  return NOISE_TONE[status] ?? 'neutral'
}

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
