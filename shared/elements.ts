// Modelo de dados do quadro, compartilhado entre o navegador e os testes.
// Todo elemento guarda a geometria em `points` (lista plana x0, y0, x1, y1, ...):
// - pen: o traço inteiro
// - rect / ellipse / arrow: dois pontos (canto inicial e final, ou origem e ponta)
// - text: um ponto (canto superior esquerdo)
// Assim mover qualquer elemento é só deslocar `points`.

export const KINDS = ['pen', 'rect', 'ellipse', 'arrow', 'text'] as const
export type Kind = (typeof KINDS)[number]

export interface BoardElement {
  id: string
  kind: Kind
  points: number[]
  color: string
  width: number
  /** Ordem de empilhamento; empate resolvido pelo id. */
  z: number
  text?: string
  /** Tamanho da fonte (só texto). */
  size?: number
  author?: string
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function isElement(value: unknown): value is BoardElement {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.kind === 'string' &&
    (KINDS as readonly string[]).includes(v.kind) &&
    Array.isArray(v.points) &&
    v.points.length >= 2 &&
    v.points.length % 2 === 0 &&
    v.points.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    typeof v.color === 'string' &&
    typeof v.width === 'number' &&
    typeof v.z === 'number'
  )
}

export function sortByZ(list: BoardElement[]): BoardElement[] {
  return [...list].sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function textMetrics(el: BoardElement): { w: number; h: number } {
  const size = el.size ?? 20
  const lines = (el.text ?? '').split('\n')
  const longest = Math.max(1, ...lines.map((l) => l.length))
  // Estimativa (largura média de 0,6 em); suficiente para seleção e exportação.
  return { w: longest * size * 0.6, h: lines.length * size * 1.25 }
}

export function bounds(el: BoardElement): Box {
  const p = el.points
  if (el.kind === 'text') {
    const { w, h } = textMetrics(el)
    return { x: p[0] ?? 0, y: p[1] ?? 0, w, h }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i + 1 < p.length; i += 2) {
    const x = p[i] as number
    const y = p[i + 1] as number
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function translate(points: number[], dx: number, dy: number): number[] {
  return points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** O ponto (x, y) acerta o elemento, com tolerância `tol` em pixels? */
export function hitTest(el: BoardElement, x: number, y: number, tol = 6): boolean {
  const p = el.points
  const reach = tol + el.width / 2
  if (el.kind === 'pen' || el.kind === 'arrow') {
    if (p.length === 2) return Math.hypot(x - (p[0] as number), y - (p[1] as number)) <= reach
    for (let i = 0; i + 3 < p.length; i += 2) {
      const d = distToSegment(
        x,
        y,
        p[i] as number,
        p[i + 1] as number,
        p[i + 2] as number,
        p[i + 3] as number,
      )
      if (d <= reach) return true
    }
    return false
  }
  const b = bounds(el)
  if (el.kind === 'ellipse') {
    const rx = b.w / 2 + reach
    const ry = b.h / 2 + reach
    const nx = (x - (b.x + b.w / 2)) / rx
    const ny = (y - (b.y + b.h / 2)) / ry
    return nx * nx + ny * ny <= 1
  }
  return x >= b.x - reach && x <= b.x + b.w + reach && y >= b.y - reach && y <= b.y + b.h + reach
}

/** Elemento visível mais acima no ponto, ou undefined. */
export function topmostAt(list: BoardElement[], x: number, y: number): BoardElement | undefined {
  const sorted = sortByZ(list)
  for (let i = sorted.length - 1; i >= 0; i--) {
    const el = sorted[i] as BoardElement
    if (hitTest(el, x, y)) return el
  }
  return undefined
}

/** Pontas da seta (duas linhas curtas a partir da ponta). */
export function arrowHead(points: number[], width: number): [number, number, number, number] {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = points
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const len = 12 + width * 2
  return [
    x2 - len * Math.cos(angle - Math.PI / 7),
    y2 - len * Math.sin(angle - Math.PI / 7),
    x2 - len * Math.cos(angle + Math.PI / 7),
    y2 - len * Math.sin(angle + Math.PI / 7),
  ]
}
