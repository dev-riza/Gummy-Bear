import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { REPORT_CATEGORY_LABELS, type ReportCategory, type ReportOut, type ReportStatus } from '../api/types'
import { Badge } from '../components/Badge'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useToast } from '../context/ToastContext'
import { formatDateTime } from '../utils/format'

const CATEGORY_TONE: Record<ReportCategory, 'good' | 'warn' | 'bad' | 'neutral'> = {
  comfortable: 'good',
  too_hot: 'bad',
  too_noisy: 'bad',
  too_bright: 'warn',
  too_dark: 'warn',
  other: 'neutral',
}

function ReportForm({ onCreated }: { onCreated: () => void }) {
  const { showToast } = useToast()
  const [category, setCategory] = useState<ReportCategory>('too_hot')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.createReport({ category, comment: comment.trim() || undefined })
      setComment('')
      showToast('Отзыв отправлен, спасибо!')
      onCreated()
    } catch {
      showToast('Не удалось отправить отзыв.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        Категория
        <select value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
          {Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Комментарий (необязательно)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Например: в западной части душно и очень шумно"
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? 'Отправляем…' : 'Оставить отзыв'}
      </button>
    </form>
  )
}

export function Reports() {
  const { showToast } = useToast()
  const [reports, setReports] = useState<ReportOut[]>([])
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCategory, setEditCategory] = useState<ReportCategory>('other')
  const [editComment, setEditComment] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .listReports(statusFilter || undefined)
      .then(setReports)
      .catch(() => setError('Не удалось загрузить отзывы.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter])

  const startEdit = (report: ReportOut) => {
    setEditingId(report.id)
    setEditCategory(report.category)
    setEditComment(report.comment ?? '')
  }

  const saveEdit = async (id: number) => {
    try {
      await api.updateReport(id, { category: editCategory, comment: editComment.trim() || undefined })
      showToast('Отзыв обновлён.')
      setEditingId(null)
      load()
    } catch {
      showToast('Не удалось обновить отзыв.', 'error')
    }
  }

  const toggleStatus = async (report: ReportOut) => {
    try {
      await api.updateReport(report.id, { status: report.status === 'open' ? 'resolved' : 'open' })
      showToast(report.status === 'open' ? 'Отзыв отмечен решённым.' : 'Отзыв возвращён в открытые.')
      load()
    } catch {
      showToast('Не удалось изменить статус.', 'error')
    }
  }

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return
    try {
      await api.deleteReport(pendingDeleteId)
      showToast('Отзыв удалён.')
      load()
    } catch {
      showToast('Не удалось удалить отзыв.', 'error')
    } finally {
      setPendingDeleteId(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Отзывы пользователей</h1>
        <p>Сообщите о текущих условиях в атриуме или посмотрите, что сообщили другие.</p>
      </div>

      <div className="card">
        <div className="section-title">Новый отзыв</div>
        <ReportForm onCreated={load} />
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div className="section-title" style={{ marginBottom: 0 }}>
            Все отзывы
          </div>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }}>
            Статус
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}>
              <option value="">Все</option>
              <option value="open">Открытые</option>
              <option value="resolved">Решённые</option>
            </select>
          </label>
        </div>

        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && reports.length === 0 && (
          <EmptyState message="Отзывов пока нет." hint="Оставьте первый отзыв выше." />
        )}

        {!loading &&
          !error &&
          reports.map((report) => (
            <div key={report.id} className="report-item">
              <div style={{ flex: 1 }}>
                <div className="report-meta">
                  <Badge tone={CATEGORY_TONE[report.category]}>
                    {REPORT_CATEGORY_LABELS[report.category]}
                  </Badge>
                  <Badge tone={report.status === 'open' ? 'warn' : 'good'}>
                    {report.status === 'open' ? 'Открыт' : 'Решён'}
                  </Badge>
                  <span className="helper-text">{formatDateTime(report.created_at)}</span>
                </div>

                {editingId === report.id ? (
                  <div className="form-grid" style={{ maxWidth: 420 }}>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ReportCategory)}
                    >
                      {Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      rows={2}
                      maxLength={500}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(report.id)}>
                        Сохранить
                      </button>
                      <button className="btn btn-sm" onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  report.comment && <p style={{ margin: 0 }}>{report.comment}</p>
                )}
              </div>

              {editingId !== report.id && (
                <div className="report-actions">
                  <button className="btn btn-sm" onClick={() => toggleStatus(report)}>
                    {report.status === 'open' ? 'Отметить решённым' : 'Вернуть в открытые'}
                  </button>
                  <button className="btn btn-sm" onClick={() => startEdit(report)}>
                    Изменить
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => setPendingDeleteId(report.id)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>

      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="Удалить отзыв?"
          message="Это действие нельзя отменить."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}
    </>
  )
}
