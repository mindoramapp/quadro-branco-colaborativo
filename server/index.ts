import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 4444)
createServer((_req, res) => res.end('ok')).listen(port, () => {
  console.log(`servidor em http://localhost:${port}`)
})
