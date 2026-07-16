import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import './Foku.css'

export type FokuMood = 'excellent' | 'normal' | 'poor' | 'friend'

const MOOD_LABEL: Record<FokuMood, string> = {
  excellent: 'идеальные условия',
  normal: 'комфортные условия',
  poor: 'некомфортные условия',
  friend: 'шумно, но неплохо — возьми с собой друга',
}

const MOOD_LINE: Record<FokuMood, string> = {
  excellent: 'Кайф! В атриуме идеальная атмосфера для фокуса.',
  normal: 'Нормально, работать можно, но не идеально.',
  poor: 'Хмм, условия не идеальны. Давай выберем другое место?',
  friend: 'Многовато шума для соло-фокуса — возьми с собой друга!',
}

const MOOD_IMAGE: Record<FokuMood, string> = {
  excellent: '/foku-excellent.png',
  normal: '/foku-normal.png',
  poor: '/foku-poor.png',
  friend: '/foku-friend.png',
}

const REPEAT_LINE = 'Эй, я же золотой, а не резиновый! Давай работать!'
const REPEAT_WINDOW_MS = 2200
const NOISY_LEVELS = new Set(['Noisy', 'Very noisy'])
const DRAG_THRESHOLD = 6
const SPRING_DURATION_MS = 500
const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

export function fokuMood(score: number | null | undefined, noise: string | null | undefined): FokuMood {
  if (score === null || score === undefined) return 'normal'
  if (score < 50) return 'poor'
  if (noise && NOISY_LEVELS.has(noise)) return 'friend'
  if (score >= 80) return 'excellent'
  return 'normal'
}

interface DragSession {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  dragging: boolean
}

interface FokuProps {
  score: number | null
  noise?: string | null
}

export function Foku({ score, noise }: FokuProps) {
  const mood = useMemo(() => fokuMood(score, noise), [score, noise])

  const sceneRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const breatheRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)

  const targetTilt = useRef({ x: 0, y: 0 })
  const currentTilt = useRef({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)

  const [jumping, setJumping] = useState(false)
  const [bubbleText, setBubbleText] = useState('')
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const lastClickAt = useRef(0)
  const bubbleTimeout = useRef<number | null>(null)
  const jumpTimeout = useRef<number | null>(null)
  const jumpRestartFrame = useRef<number | null>(null)

  // Drag-to-move: position is tracked in plain px offsets applied directly to
  // .foku-scene (which otherwise has no transform of its own, so this never
  // fights the tilt/breathe/jump layers living on descendants). Clamped to
  // the enclosing .card so Foku can be picked up and carried around the
  // widget but never escapes it; on release it springs back to its original
  // spot rather than staying put.
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragSession = useRef<DragSession | null>(null)
  const suppressClick = useRef(false)
  const springTimeout = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Main animation loop: LERP-eases the 3D tilt toward the mouse-driven
  // target, and drives a sine-wave breathing offset — both computed every
  // frame and written directly to separate elements' inline transforms so
  // neither fights the other (or the click-jump CSS animation) for control
  // of a shared `transform` property.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const LERP = 0.08
    const start = performance.now()

    const tick = (now: number) => {
      currentTilt.current.x += (targetTilt.current.x - currentTilt.current.x) * LERP
      currentTilt.current.y += (targetTilt.current.y - currentTilt.current.y) * LERP
      if (tiltRef.current) {
        tiltRef.current.style.transform = `rotateX(${currentTilt.current.x.toFixed(3)}deg) rotateY(${currentTilt.current.y.toFixed(3)}deg)`
      }

      const t = (now - start) / 1000
      const breatheY = Math.sin(t * 1.6) * 3
      const breatheScale = 1 + Math.sin(t * 1.6) * 0.014
      if (breatheRef.current) {
        breatheRef.current.style.transform = `translateY(${breatheY.toFixed(2)}px) scale(${breatheScale.toFixed(4)})`
      }

      if (shadowRef.current) {
        const lift = Math.max(0, breatheY)
        const shadowScale = 1 - lift * 0.015
        const shadowOpacity = 0.85 - lift * 0.04
        shadowRef.current.style.transform = `translateX(-50%) scale(${shadowScale.toFixed(3)})`
        shadowRef.current.style.opacity = shadowOpacity.toFixed(2)
      }

      rafId.current = requestAnimationFrame(tick)
    }

    rafId.current = requestAnimationFrame(tick)
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  // Full cleanup of every timer on unmount.
  useEffect(() => {
    return () => {
      if (bubbleTimeout.current) window.clearTimeout(bubbleTimeout.current)
      if (jumpTimeout.current) window.clearTimeout(jumpTimeout.current)
      if (jumpRestartFrame.current !== null) cancelAnimationFrame(jumpRestartFrame.current)
      if (springTimeout.current) window.clearTimeout(springTimeout.current)
    }
  }, [])

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = sceneRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    targetTilt.current = { x: py * -16, y: px * 22 }
  }

  const handleMouseLeave = () => {
    targetTilt.current = { x: 0, y: 0 }
  }

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const scene = sceneRef.current
    if (!scene) return

    // Cancel any in-flight spring-back and snap to rest immediately, so a
    // re-grab mid-animation starts from a known position instead of the
    // stale pre-spring offset.
    if (springTimeout.current !== null) {
      window.clearTimeout(springTimeout.current)
      springTimeout.current = null
      dragOffset.current = { x: 0, y: 0 }
    }
    scene.style.transition = 'none'
    scene.style.transform = `translate(${dragOffset.current.x}px, ${dragOffset.current.y}px)`

    const sceneRect = scene.getBoundingClientRect()
    const naturalLeft = sceneRect.left - dragOffset.current.x
    const naturalTop = sceneRect.top - dragOffset.current.y
    const naturalRight = naturalLeft + sceneRect.width
    const naturalBottom = naturalTop + sceneRect.height

    // Clamped to the viewport, not the card — Foku can be carried anywhere
    // on screen (over other cards, over the nav) while held, and springs
    // back to its original spot on release.
    const minX = 0 - naturalLeft
    const maxX = window.innerWidth - naturalRight
    const minY = 0 - naturalTop
    const maxY = window.innerHeight - naturalBottom

    dragSession.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: dragOffset.current.x,
      originY: dragOffset.current.y,
      minX,
      maxX,
      minY,
      maxY,
      dragging: false,
    }
    scene.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== e.pointerId) return

    const dx = e.clientX - session.startX
    const dy = e.clientY - session.startY

    if (!session.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      session.dragging = true
      setIsDragging(true)
    }

    if (session.dragging) {
      const nextX = Math.min(session.maxX, Math.max(session.minX, session.originX + dx))
      const nextY = Math.min(session.maxY, Math.max(session.minY, session.originY + dy))
      dragOffset.current = { x: nextX, y: nextY }
      if (sceneRef.current) {
        sceneRef.current.style.transform = `translate(${nextX.toFixed(1)}px, ${nextY.toFixed(1)}px)`
      }
    }
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const session = dragSession.current
    if (!session || session.pointerId !== e.pointerId) return

    const scene = sceneRef.current
    if (scene?.hasPointerCapture(e.pointerId)) {
      scene.releasePointerCapture(e.pointerId)
    }
    dragSession.current = null
    setIsDragging(false)

    if (session.dragging) {
      suppressClick.current = true
      if (scene) {
        scene.style.transition = `transform ${SPRING_DURATION_MS}ms ${SPRING_EASING}`
        scene.style.transform = 'translate(0px, 0px)'
      }
      dragOffset.current = { x: 0, y: 0 }
      springTimeout.current = window.setTimeout(() => {
        if (scene) scene.style.transition = 'none'
        springTimeout.current = null
      }, SPRING_DURATION_MS)
    }
  }

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }

    const now = performance.now()
    const isRepeat = now - lastClickAt.current < REPEAT_WINDOW_MS
    lastClickAt.current = now

    if (jumpTimeout.current) window.clearTimeout(jumpTimeout.current)
    if (bubbleTimeout.current) window.clearTimeout(bubbleTimeout.current)
    if (jumpRestartFrame.current !== null) cancelAnimationFrame(jumpRestartFrame.current)

    // Restart the jump animation even on rapid repeat clicks: drop the class,
    // wait a frame so the browser registers the removal, then re-add it.
    setJumping(false)
    jumpRestartFrame.current = requestAnimationFrame(() => setJumping(true))

    setBubbleText(isRepeat ? REPEAT_LINE : MOOD_LINE[mood])
    setBubbleVisible(true)

    jumpTimeout.current = window.setTimeout(() => setJumping(false), 460)
    bubbleTimeout.current = window.setTimeout(() => setBubbleVisible(false), 3000)
  }

  const tooltipText =
    score !== null
      ? `Comfort score: ${score}/100 — ${MOOD_LABEL[mood]}`
      : `Пока нет данных — ${MOOD_LABEL[mood]}`

  return (
    <div className="foku-scene-wrap">
      <div
        ref={sceneRef}
        className={`foku-scene ${mood}${isDragging ? ' dragging' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Foku: ${MOOD_LABEL[mood]}. Нажмите или перетащите, чтобы взаимодействовать.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <div ref={shadowRef} className="foku-shadow" aria-hidden="true" />

        <div ref={tiltRef} className="foku-tilt">
          <div ref={breatheRef} className="foku-breathe">
            <div className={`foku-jump-layer${jumping ? ' jumping' : ''}`}>
              <div className={`foku-bubble${bubbleVisible ? ' visible' : ''}`} aria-live="polite">
                {bubbleText}
              </div>

              <img
                src={MOOD_IMAGE[mood]}
                alt={MOOD_LABEL[mood]}
                className="foku-image"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <div className="foku-hover-tip">{tooltipText}</div>
      </div>
    </div>
  )
}
