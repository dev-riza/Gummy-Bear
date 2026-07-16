const VISITOR_ID_KEY = 'atriumsense-visitor-id'

/** Anonymous per-browser identifier — no login involved. Generated once and
 * persisted in localStorage so a returning visitor's saved preference can be
 * looked up again on their next visit. */
export function getOrCreateVisitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY)
  if (existing) return existing

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(VISITOR_ID_KEY, id)
  return id
}
