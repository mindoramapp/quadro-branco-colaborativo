import { useEffect, useState } from 'react'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { Board } from '../shared/board.ts'
import { Whiteboard } from './Whiteboard.tsx'

export function App() {
  const [board, setBoard] = useState<Board | null>(null)

  useEffect(() => {
    const doc = new Y.Doc()
    const persistence = new IndexeddbPersistence('quadro-local', doc)
    const b = new Board(doc)
    void persistence.whenSynced.then(() => setBoard(b))
    return () => {
      setBoard(null)
      b.destroy()
      void persistence.destroy()
      doc.destroy()
    }
  }, [])

  if (!board) return <p className="loading">Carregando…</p>
  return <Whiteboard board={board} readOnly={false} author="local" />
}
