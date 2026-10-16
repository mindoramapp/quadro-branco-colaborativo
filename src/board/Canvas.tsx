import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Board } from '../../shared/board.ts'
import { topmostAt, type BoardElement, type Kind } from '../../shared/elements.ts'
import { drawScene } from './render.ts'

export type Tool = 'select' | 'eraser' | Kind

export interface Style {
  color: string
  width: number
}

type Gesture =
  | { type: 'draw'; id: string; kind: Kind; points: number[] }
  | { type: 'move'; startX: number; startY: number; origins: Map<string, number[]> }
  | { type: 'erase' }

interface Props {
  board: Board
  tool: Tool
  style: Style
  readOnly: boolean
  author: string
  selected: Set<string>
  onSelect: (ids: Set<string>) => void
  onPointer?: (point: { x: number; y: number } | null) => void
}

const TEXT_SIZE = 22

export function Canvas({
  board,
  tool,
  style,
  readOnly,
  author,
  selected,
  onSelect,
  onPointer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [count, setCount] = useState(0)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null)

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Redesenha a cada mudança do documento (local ou remota), no máximo uma vez por quadro.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    let frame = 0
    const draw = () => {
      frame = 0
      const list = board.list()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawScene(ctx, list, { width: size.w, height: size.h, selected })
      setCount(list.length)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }
    draw()
    const off = board.onChange(schedule)
    return () => {
      off()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [board, size, selected])

  const pos = (e: ReactPointerEvent) => {
    const r = (e.target as HTMLElement).getBoundingClientRect()
    return {
      x: Math.round((e.clientX - r.left) * 10) / 10,
      y: Math.round((e.clientY - r.top) * 10) / 10,
    }
  }

  const eraseAt = (x: number, y: number) => {
    const hit = topmostAt(board.list(), x, y)
    if (hit) board.remove([hit.id])
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly || e.button !== 0) return
    const { x, y } = pos(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    board.commit()
    switch (tool) {
      case 'select': {
        const hit = topmostAt(board.list(), x, y)
        if (!hit) {
          onSelect(new Set())
          return
        }
        const ids = selected.has(hit.id) ? selected : new Set([hit.id])
        onSelect(ids)
        const origins = new Map<string, number[]>()
        for (const id of ids) {
          const el = board.get(id)
          if (el) origins.set(id, el.points)
        }
        gesture.current = { type: 'move', startX: x, startY: y, origins }
        return
      }
      case 'eraser':
        gesture.current = { type: 'erase' }
        eraseAt(x, y)
        return
      case 'text':
        // Sem isto o clique devolve o foco ao canvas e a caixa de texto fecha na hora.
        e.preventDefault()
        setTextInput({ x, y, value: '' })
        return
      default: {
        const points = tool === 'pen' ? [x, y] : [x, y, x, y]
        const id = board.add({ kind: tool, points, color: style.color, width: style.width, author })
        gesture.current = { type: 'draw', id, kind: tool, points }
      }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pos(e)
    onPointer?.({ x, y })
    const g = gesture.current
    if (!g) return
    if (g.type === 'erase') eraseAt(x, y)
    else if (g.type === 'move') board.moveFrom(g.origins, x - g.startX, y - g.startY)
    else if (g.kind === 'pen') {
      const lx = g.points[g.points.length - 2] as number
      const ly = g.points[g.points.length - 1] as number
      if (Math.hypot(x - lx, y - ly) < 2) return
      g.points = [...g.points, x, y]
      board.update(g.id, { points: g.points })
    } else {
      g.points = [g.points[0] as number, g.points[1] as number, x, y]
      board.update(g.id, { points: g.points })
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    if (g?.type === 'draw' && g.kind !== 'pen') {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = g.points
      // Clique sem arrastar não cria forma vazia.
      if (Math.hypot(x2 - x1, y2 - y1) < 3) board.remove([g.id])
    }
    board.commit()
  }

  const commitText = () => {
    if (textInput && textInput.value.trim()) {
      board.add({
        kind: 'text',
        points: [textInput.x, textInput.y],
        text: textInput.value,
        size: TEXT_SIZE,
        color: style.color,
        width: 1,
        author,
      } satisfies Omit<BoardElement, 'id' | 'z'>)
      board.commit()
    }
    setTextInput(null)
  }

  const cursor = readOnly
    ? 'default'
    : tool === 'select'
      ? 'default'
      : tool === 'text'
        ? 'text'
        : tool === 'eraser'
          ? 'cell'
          : 'crosshair'

  return (
    <>
      <canvas
        ref={canvasRef}
        className="board"
        data-testid="board"
        data-count={count}
        aria-label={`Quadro com ${count} elementos`}
        role="img"
        style={{ width: size.w, height: size.h, cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => onPointer?.(null)}
      />
      {textInput && (
        <textarea
          className="text-input"
          aria-label="Texto"
          autoFocus
          rows={1}
          style={{ left: textInput.x, top: textInput.y, color: style.color, fontSize: TEXT_SIZE }}
          value={textInput.value}
          onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commitText()
            } else if (e.key === 'Escape') setTextInput(null)
          }}
        />
      )}
    </>
  )
}
