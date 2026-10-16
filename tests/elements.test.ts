import { describe, expect, it } from 'vitest'
import {
  bounds,
  hitTest,
  isElement,
  sortByZ,
  topmostAt,
  translate,
  type BoardElement,
} from '../shared/elements.ts'

const el = (over: Partial<BoardElement>): BoardElement => ({
  id: 'a',
  kind: 'rect',
  points: [10, 10, 50, 30],
  color: '#000',
  width: 2,
  z: 1,
  ...over,
})

describe('geometria dos elementos', () => {
  it('calcula a caixa de um retângulo desenhado de trás para frente', () => {
    expect(bounds(el({ points: [50, 30, 10, 10] }))).toEqual({ x: 10, y: 10, w: 40, h: 20 })
  })

  it('acerta o traço da caneta só perto da linha', () => {
    const pen = el({ kind: 'pen', points: [0, 0, 100, 0] })
    expect(hitTest(pen, 50, 3)).toBe(true)
    expect(hitTest(pen, 50, 30)).toBe(false)
  })

  it('acerta a elipse dentro e erra no canto da caixa', () => {
    const e = el({ kind: 'ellipse', points: [0, 0, 100, 100] })
    expect(hitTest(e, 50, 50)).toBe(true)
    expect(hitTest(e, 2, 2)).toBe(false)
  })

  it('escolhe o elemento mais acima', () => {
    const a = el({ id: 'a', z: 1 })
    const b = el({ id: 'b', z: 2 })
    expect(topmostAt([b, a], 20, 20)?.id).toBe('b')
    expect(sortByZ([b, a]).map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('desloca pontos e valida dados vindos da rede', () => {
    expect(translate([1, 2, 3, 4], 10, 20)).toEqual([11, 22, 13, 24])
    expect(isElement(el({}))).toBe(true)
    expect(isElement({ ...el({}), points: [1, 2, 3] })).toBe(false)
    expect(isElement({ ...el({}), kind: 'script' })).toBe(false)
  })
})
