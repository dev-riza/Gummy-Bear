export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(d)
}

export function formatTemp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(1)}°C`
}
