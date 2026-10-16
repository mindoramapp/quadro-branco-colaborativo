import { describe, expect, it } from 'vitest'
import type { BoardElement } from '../shared/elements.ts'
import { toSvg } from '../shared/svg.ts'

const common = { color: '#e03131', width: 2, z: 1 }

describe('exportação SVG', () => {
  it('gera uma forma por elemento e escapa o texto', () => {
    const list: BoardElement[] = [
      { ...common, id: '1', kind: 'rect', points: [0, 0, 40, 20] },
      { ...common, id: '2', kind: 'ellipse', points: [50, 0, 90, 40] },
      { ...common, id: '3', kind: 'pen', points: [0, 50, 10, 60, 20, 50] },
      { ...common, id: '4', kind: 'arrow', points: [0, 80, 60, 80] },
      { ...common, id: '5', kind: 'text', points: [0, 100], text: '<b>&"oi"</b>', size: 20 },
    ]
    const svg = toSvg(list)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox=/)
    expect(svg).toContain('<rect x="0" y="0" width="40" height="20"')
    expect(svg).toContain('<ellipse cx="70" cy="20" rx="20" ry="20"')
    expect(svg).toContain('<polyline points="0 50 10 60 20 50"')
    expect(svg).toContain('<line x1="0" y1="80" x2="60" y2="80"')
    expect(svg).toContain('&#60;b&#62;&#38;&#34;oi&#34;&#60;/b&#62;')
    expect(svg).not.toContain('<b>')
  })

  it('quadro vazio gera um SVG válido', () => {
    expect(toSvg([])).toContain('viewBox="-20 -20 140 140"')
  })
})
