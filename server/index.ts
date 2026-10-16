import { existsSync } from 'node:fs'
import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 4444)
const secret = process.env.ROOM_SECRET
if (!secret || secret === 'troque-este-segredo') {
  console.error('Defina ROOM_SECRET no .env (veja .env.example).')
  process.exit(1)
}

const app = createApp({
  secret,
  dbPath: process.env.DB_PATH ?? './data/quadro.db',
  staticDir: existsSync('dist/index.html') ? 'dist' : undefined,
})

app.server.listen(port, () => {
  console.log(`servidor em http://localhost:${port} (relay /sync, sinalização /signal, API /api)`)
})

const stop = () => {
  console.log('encerrando: gravando salas abertas…')
  void app.close().then(() => process.exit(0))
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
