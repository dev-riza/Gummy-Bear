export function LoadingState({ label = 'Загрузка данных…' }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({
  message = 'Не удалось загрузить данные.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="state-block" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Повторить попытку
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  message = 'Данных пока нет.',
  hint,
}: {
  message?: string
  hint?: string
}) {
  return (
    <div className="state-block">
      <p>{message}</p>
      {hint && <p className="helper-text">{hint}</p>}
    </div>
  )
}
