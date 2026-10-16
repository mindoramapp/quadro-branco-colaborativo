import { arrowHead, bounds, sortByZ, type BoardElement } from './elements.ts'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

function elementToSvg(el: BoardElement): string {
  const stroke = `stroke="${esc(el.color)}" stroke-width="${num(el.width)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const p = el.points.map(num)
  switch (el.kind) {
    case 'pen':
      if (p.length === 2) {
        return `<circle cx="${p[0]}" cy="${p[1]}" r="${num(el.width / 2)}" fill="${esc(el.color)}"/>`
      }
      return `<polyline points="${p.join(' ')}" ${stroke}/>`
    case 'rect': {
      const b = bounds(el)
      return `<rect x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" ${stroke}/>`
    }
    case 'ellipse': {
      const b = bounds(el)
      return `<ellipse cx="${num(b.x + b.w / 2)}" cy="${num(b.y + b.h / 2)}" rx="${num(b.w / 2)}" ry="${num(b.h / 2)}" ${stroke}/>`
    }
    case 'arrow': {
      const [hx1, hy1, hx2, hy2] = arrowHead(el.points, el.width).map(num)
      return (
        `<line x1="${p[0]}" y1="${p[1]}" x2="${p[2]}" y2="${p[3]}" ${stroke}/>` +
        `<polyline points="${hx1},${hy1} ${p[2]},${p[3]} ${hx2},${hy2}" ${stroke}/>`
      )
    }
    case 'text': {
      const size = el.size ?? 20
      const lines = (el.text ?? '').split('\n')
      const tspans = lines
        .map(
          (l, i) =>
            `<tspan x="${p[0]}" dy="${i === 0 ? num(size) : num(size * 1.25)}">${esc(l)}</tspan>`,
        )
        .join('')
      return `<text x="${p[0]}" y="${p[1]}" font-family="sans-serif" font-size="${num(size)}" fill="${esc(el.color)}">${tspans}</text>`
    }
  }
}

/** Gera um SVG autocontido com todos os elementos, recortado ao conteúdo (com margem). */
export function toSvg(elements: BoardElement[], background = '#ffffff', margin = 20): string {
  const list = sortByZ(elements)
  let minX = 0
  let minY = 0
  let maxX = 100
  let maxY = 100
  if (list.length > 0) {
    minX = Infinity
    minY = Infinity
    maxX = -Infinity
    maxY = -Infinity
    for (const el of list) {
      const b = bounds(el)
      const pad = el.width + (el.kind === 'arrow' ? 14 + el.width * 2 : 0)
      minX = Math.min(minX, b.x - pad)
      minY = Math.min(minY, b.y - pad)
      maxX = Math.max(maxX, b.x + b.w + pad)
      maxY = Math.max(maxY, b.y + b.h + pad)
    }
  }
  const x = minX - margin
  const y = minY - margin
  const w = maxX - minX + margin * 2
  const h = maxY - minY + margin * 2
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}" width="${num(w)}" height="${num(h)}">`,
    `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${esc(background)}"/>`,
    ...list.map(elementToSvg),
    '</svg>',
  ].join('\n')
}
