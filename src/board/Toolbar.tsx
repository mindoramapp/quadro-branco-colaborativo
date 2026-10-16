import type { Style, Tool } from './Canvas.tsx'

export const TOOLS: { id: Tool; label: string; key: string; icon: string }[] = [
  { id: 'select', label: 'Selecionar e mover', key: 'v', icon: '➤' },
  { id: 'pen', label: 'Caneta', key: 'p', icon: '✎' },
  { id: 'rect', label: 'Retângulo', key: 'r', icon: '▭' },
  { id: 'ellipse', label: 'Elipse', key: 'o', icon: '◯' },
  { id: 'arrow', label: 'Seta', key: 'a', icon: '➝' },
  { id: 'text', label: 'Texto', key: 't', icon: 'T' },
  { id: 'eraser', label: 'Borracha', key: 'e', icon: '⌫' },
]

export const COLORS = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5']
const WIDTHS = [2, 4, 8]

interface Props {
  tool: Tool
  style: Style
  readOnly: boolean
  canUndo: boolean
  canRedo: boolean
  onTool: (t: Tool) => void
  onStyle: (s: Style) => void
  onUndo: () => void
  onRedo: () => void
}

export function Toolbar(p: Props) {
  if (p.readOnly) {
    return (
      <div className="toolbar" role="toolbar" aria-label="Ferramentas">
        <span className="badge" data-testid="readonly">
          Somente leitura
        </span>
      </div>
    )
  }
  return (
    <div className="toolbar" role="toolbar" aria-label="Ferramentas">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tool"
          aria-pressed={p.tool === t.id}
          title={`${t.label} (${t.key.toUpperCase()})`}
          aria-label={t.label}
          onClick={() => p.onTool(t.id)}
        >
          {t.icon}
        </button>
      ))}
      <span className="sep" />
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className="swatch"
          style={{ background: c }}
          aria-pressed={p.style.color === c}
          aria-label={`Cor ${c}`}
          onClick={() => p.onStyle({ ...p.style, color: c })}
        />
      ))}
      <span className="sep" />
      {WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          className="tool"
          aria-pressed={p.style.width === w}
          aria-label={`Espessura ${w}`}
          onClick={() => p.onStyle({ ...p.style, width: w })}
        >
          <span className="dot" style={{ width: w + 2, height: w + 2 }} />
        </button>
      ))}
      <span className="sep" />
      <button
        type="button"
        className="tool"
        title="Desfazer (Ctrl+Z)"
        aria-label="Desfazer"
        disabled={!p.canUndo}
        onClick={p.onUndo}
      >
        ↶
      </button>
      <button
        type="button"
        className="tool"
        title="Refazer (Ctrl+Shift+Z)"
        aria-label="Refazer"
        disabled={!p.canRedo}
        onClick={p.onRedo}
      >
        ↷
      </button>
    </div>
  )
}
