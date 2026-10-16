// Formato dos links de sala, compartilhado entre o navegador e o servidor.
// Token = "<papel>.<assinatura>", em que a assinatura é HMAC-SHA256(ROOM_SECRET, "<sala>:<papel>").
// O papel é legível pelo cliente (para a interface); só o servidor consegue validar a assinatura.

export type Role = 'editor' | 'reader'

export const ROOM_ID = /^[A-Za-z0-9_-]{6,32}$/

/** Nome da sala no y-webrtc (tópico da sinalização). */
export const webrtcRoom = (roomId: string) => `quadro-${roomId}`

export function roleOf(token: string | null | undefined): Role | null {
  const role = token?.split('.')[0]
  return role === 'editor' || role === 'reader' ? role : null
}

export interface RoomLinks {
  roomId: string
  editor: string
  reader: string
}

export interface SnapshotInfo {
  id: number
  label: string
  author: string
  createdAt: string
  elements: number
}
