import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { Board, elementsFromUpdate } from '../shared/board.ts'

const base = { kind: 'rect' as const, color: '#000', width: 2 }

function pair() {
  const a = new Board(new Y.Doc())
  const b = new Board(new Y.Doc())
  // Liga os dois documentos como se houvesse rede (updates remotos têm outra origem).
  a.doc.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(b.doc, u, 'remote'),
  )
  b.doc.on(
    'update',
    (u: Uint8Array, origin: unknown) => origin !== 'remote' && Y.applyUpdate(a.doc, u, 'remote'),
  )
  return { a, b }
}

describe('Board (Yjs)', () => {
  it('cria, move e remove elementos', () => {
    const board = new Board(new Y.Doc())
    const id = board.add({ ...base, points: [0, 0, 10, 10] })
    board.moveFrom(new Map([[id, [0, 0, 10, 10]]]), 5, 5)
    expect(board.get(id)?.points).toEqual([5, 5, 15, 15])
    board.remove([id])
    expect(board.list()).toHaveLength(0)
  })

  it('edições concorrentes em campos diferentes se combinam', () => {
    const { a, b } = pair()
    const id = a.add({ ...base, points: [0, 0, 10, 10] })
    a.doc.transact(() => a.elements.get(id)?.set('color', '#f00'))
    b.update(id, { points: [100, 100, 110, 110] })
    expect(a.get(id)).toMatchObject({ color: '#f00', points: [100, 100, 110, 110] })
    expect(a.list()).toEqual(b.list())
  })

  it('desfazer só reverte as ações do próprio usuário', () => {
    const { a, b } = pair()
    a.add({ ...base, points: [0, 0, 1, 1], id: 'de-a' })
    a.commit()
    b.add({ ...base, points: [5, 5, 6, 6], id: 'de-b' })
    b.commit()
    a.undo()
    expect(a.list().map((e) => e.id)).toEqual(['de-b'])
    a.redo()
    expect(
      b
        .list()
        .map((e) => e.id)
        .sort(),
    ).toEqual(['de-a', 'de-b'])
  })

  it('um traço inteiro é desfeito de uma vez', () => {
    const board = new Board(new Y.Doc())
    const id = board.add({ ...base, kind: 'pen', points: [0, 0] })
    for (let i = 1; i <= 20; i++) board.update(id, { points: [0, 0, i, i] })
    board.commit()
    board.undo()
    expect(board.list()).toHaveLength(0)
  })

  it('restaura snapshot como uma ação desfazível', () => {
    const board = new Board(new Y.Doc())
    board.add({ ...base, points: [0, 0, 1, 1], id: 'v1' })
    const snapshot = Y.encodeStateAsUpdate(board.doc)
    board.add({ ...base, points: [2, 2, 3, 3], id: 'v2' })
    board.commit()
    board.replaceAll(elementsFromUpdate(snapshot))
    expect(board.list().map((e) => e.id)).toEqual(['v1'])
    board.undo()
    expect(board.list().map((e) => e.id)).toEqual(['v1', 'v2'])
  })
})
