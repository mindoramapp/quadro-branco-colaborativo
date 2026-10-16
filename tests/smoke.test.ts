import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

describe('ambiente', () => {
  it('dois Y.Doc convergem trocando updates', () => {
    const a = new Y.Doc()
    const b = new Y.Doc()
    a.getMap('m').set('x', 1)
    b.getMap('m').set('y', 2)
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    expect(a.getMap('m').toJSON()).toEqual(b.getMap('m').toJSON())
  })
})
