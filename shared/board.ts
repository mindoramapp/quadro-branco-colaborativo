import * as Y from 'yjs'
import { isElement, sortByZ, translate, type BoardElement } from './elements.ts'

// Documento Yjs do quadro:
//   doc.getMap('elements'): id -> Y.Map com os campos de BoardElement
// Cada elemento é um Y.Map próprio, então edições concorrentes em campos diferentes
// (um usuário move, outro troca a cor) se combinam em vez de uma sobrescrever a outra.

export type ElementMap = Y.Map<unknown>

const FIELDS = ['id', 'kind', 'points', 'color', 'width', 'z', 'text', 'size', 'author'] as const

function readElement(m: ElementMap): BoardElement | null {
  const obj: Record<string, unknown> = {}
  for (const f of FIELDS) {
    const v = m.get(f)
    if (v !== undefined) obj[f] = v
  }
  return isElement(obj) ? obj : null
}

let counter = 0
export function newId(clientId: number): string {
  counter = (counter + 1) % 1_000_000
  return `${clientId.toString(36)}-${Date.now().toString(36)}-${counter.toString(36)}`
}

export class Board {
  readonly doc: Y.Doc
  readonly elements: Y.Map<ElementMap>
  readonly undoManager: Y.UndoManager
  /** Origem das transações deste cliente: só elas entram no desfazer dele. */
  readonly origin = { local: true }

  constructor(doc: Y.Doc) {
    this.doc = doc
    this.elements = doc.getMap<ElementMap>('elements')
    this.undoManager = new Y.UndoManager(this.elements, {
      trackedOrigins: new Set([this.origin]),
      captureTimeout: 400,
    })
  }

  private transact(fn: () => void) {
    this.doc.transact(fn, this.origin)
  }

  list(): BoardElement[] {
    const out: BoardElement[] = []
    this.elements.forEach((m) => {
      const el = readElement(m)
      if (el) out.push(el)
    })
    return sortByZ(out)
  }

  get(id: string): BoardElement | null {
    const m = this.elements.get(id)
    return m ? readElement(m) : null
  }

  nextZ(): number {
    let max = 0
    this.elements.forEach((m) => {
      const z = m.get('z')
      if (typeof z === 'number' && z > max) max = z
    })
    return max + 1
  }

  /** Cria um elemento. `z` e `id` são preenchidos se faltarem. */
  add(data: Omit<BoardElement, 'id' | 'z'> & Partial<Pick<BoardElement, 'id' | 'z'>>): string {
    const id = data.id ?? newId(this.doc.clientID)
    const z = data.z ?? this.nextZ()
    this.transact(() => {
      const m = new Y.Map<unknown>()
      for (const [k, v] of Object.entries({ ...data, id, z })) {
        if (v !== undefined) m.set(k, v)
      }
      this.elements.set(id, m)
    })
    return id
  }

  update(id: string, patch: Partial<Omit<BoardElement, 'id'>>) {
    const m = this.elements.get(id)
    if (!m) return
    this.transact(() => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) m.delete(k)
        else m.set(k, v)
      }
    })
  }

  /** Desloca os elementos a partir das posições originais (sem acumular erro durante o arraste). */
  moveFrom(origins: Map<string, number[]>, dx: number, dy: number) {
    this.transact(() => {
      for (const [id, points] of origins) {
        this.elements.get(id)?.set('points', translate(points, dx, dy))
      }
    })
  }

  remove(ids: Iterable<string>) {
    this.transact(() => {
      for (const id of ids) this.elements.delete(id)
    })
  }

  /** Substitui todo o conteúdo (restauração de snapshot). Fica no desfazer como uma ação só. */
  replaceAll(list: BoardElement[]) {
    this.undoManager.stopCapturing()
    this.transact(() => {
      for (const id of [...this.elements.keys()]) this.elements.delete(id)
      for (const el of list) {
        const m = new Y.Map<unknown>()
        for (const [k, v] of Object.entries(el)) if (v !== undefined) m.set(k, v)
        this.elements.set(el.id, m)
      }
    })
    this.undoManager.stopCapturing()
  }

  /** Fecha o grupo atual do desfazer (fim de um traço ou arraste). */
  commit() {
    this.undoManager.stopCapturing()
  }

  undo() {
    this.undoManager.undo()
  }

  redo() {
    this.undoManager.redo()
  }

  onChange(fn: () => void): () => void {
    const handler = () => fn()
    this.elements.observeDeep(handler)
    return () => this.elements.unobserveDeep(handler)
  }

  destroy() {
    this.undoManager.destroy()
  }
}

/** Lê os elementos de um estado codificado (snapshot) sem tocar no documento atual. */
export function elementsFromUpdate(update: Uint8Array): BoardElement[] {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  const board = new Board(doc)
  const list = board.list()
  board.destroy()
  doc.destroy()
  return list
}
