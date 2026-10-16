import { arrowHead, bounds, type BoardElement } from '../../shared/elements.ts'

export function drawElement(ctx: CanvasRenderingContext2D, el: BoardElement) {
  const p = el.points
  ctx.strokeStyle = el.color
  ctx.fillStyle = el.color
  ctx.lineWidth = el.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (el.kind) {
    case 'pen': {
      if (p.length === 2) {
        ctx.beginPath()
        ctx.arc(p[0] as number, p[1] as number, el.width / 2, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      ctx.beginPath()
      ctx.moveTo(p[0] as number, p[1] as number)
      for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i] as number, p[i + 1] as number)
      ctx.stroke()
      return
    }
    case 'rect': {
      const b = bounds(el)
      ctx.strokeRect(b.x, b.y, b.w, b.h)
      return
    }
    case 'ellipse': {
      const b = bounds(el)
      ctx.beginPath()
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      return
    }
    case 'arrow': {
      const [hx1, hy1, hx2, hy2] = arrowHead(p, el.width)
      ctx.beginPath()
      ctx.moveTo(p[0] as number, p[1] as number)
      ctx.lineTo(p[2] as number, p[3] as number)
      ctx.moveTo(hx1, hy1)
      ctx.lineTo(p[2] as number, p[3] as number)
      ctx.lineTo(hx2, hy2)
      ctx.stroke()
      return
    }
    case 'text': {
      const size = el.size ?? 20
      ctx.font = `${size}px sans-serif`
      ctx.textBaseline = 'top'
      ;(el.text ?? '').split('\n').forEach((line, i) => {
        ctx.fillText(line, p[0] as number, (p[1] as number) + i * size * 1.25)
      })
      return
    }
  }
}

export function drawSelection(ctx: CanvasRenderingContext2D, el: BoardElement) {
  const b = bounds(el)
  const pad = 6 + el.width / 2
  ctx.save()
  ctx.strokeStyle = '#1f6feb'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
  ctx.restore()
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  elements: BoardElement[],
  opts: { width: number; height: number; background?: string; selected?: Set<string> },
) {
  ctx.save()
  ctx.fillStyle = opts.background ?? '#ffffff'
  ctx.fillRect(0, 0, opts.width, opts.height)
  for (const el of elements) drawElement(ctx, el)
  if (opts.selected) for (const el of elements) if (opts.selected.has(el.id)) drawSelection(ctx, el)
  ctx.restore()
}
