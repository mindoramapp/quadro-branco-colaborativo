import { useEffect, useState } from 'react'
import type { Board } from '../shared/board.ts'
import { Canvas, type Style, type Tool } from './board/Canvas.tsx'
import { TOOLS, Toolbar } from './board/Toolbar.tsx'

interface Props {
  board: Board
  readOnly: boolean
  author: string
}

function useUndoState(board: Board) {
  const [state, setState] = useState({ canUndo: false, canRedo: false })
  useEffect(() => {
    const um = board.undoManager
    const update = () => setState({ canUndo: um.canUndo(), canRedo: um.canRedo() })
    update()
    um.on('stack-item-added', update)
    um.on('stack-item-popped', update)
    um.on('stack-cleared', update)
    return () => {
      um.off('stack-item-added', update)
      um.off('stack-item-popped', update)
      um.off('stack-cleared', update)
    }
  }, [board])
  return state
}

export function Whiteboard({ board, readOnly, author }: Props) {
  const [tool, setTool] = useState<Tool>('pen')
  const [style, setStyle] = useState<Style>({ color: '#1e1e1e', width: 4 })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const undo = useUndoState(board)

  // Remove da seleção o que outro usuário (ou o desfazer) apagou.
  useEffect(
    () =>
      board.onChange(() =>
        setSelected((s) => {
          const kept = [...s].filter((id) => board.elements.has(id))
          return kept.length === s.size ? s : new Set(kept)
        }),
      ),
    [board],
  )

  useEffect(() => {
    if (readOnly) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) board.redo()
        else board.undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        board.redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) {
        board.remove(selected)
        board.commit()
        setSelected(new Set())
      } else if (!mod && !e.altKey) {
        const t = TOOLS.find((t) => t.key === key)
        if (t) setTool(t.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [board, readOnly, selected])

  return (
    <>
      <Canvas
        board={board}
        tool={tool}
        style={style}
        readOnly={readOnly}
        author={author}
        selected={selected}
        onSelect={setSelected}
      />
      <Toolbar
        tool={tool}
        style={style}
        readOnly={readOnly}
        canUndo={undo.canUndo}
        canRedo={undo.canRedo}
        onTool={(t) => {
          setTool(t)
          if (t !== 'select') setSelected(new Set())
        }}
        onStyle={setStyle}
        onUndo={() => board.undo()}
        onRedo={() => board.redo()}
      />
    </>
  )
}
