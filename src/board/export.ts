import type { BoardElement } from '../../shared/elements.ts'
import { toSvg } from '../../shared/svg.ts'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

export function exportSvg(elements: BoardElement[]) {
  download(new Blob([toSvg(elements)], { type: 'image/svg+xml' }), `quadro-${stamp()}.svg`)
}

/** PNG a partir do mesmo SVG (um só desenho para os dois formatos), em resolução 2x. */
export async function exportPng(elements: BoardElement[], scale = 2) {
  const svg = toSvg(elements)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(img.width * scale)
  canvas.height = Math.ceil(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('falha ao gerar o PNG')
  download(blob, `quadro-${stamp()}.png`)
}
