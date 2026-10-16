# Imagem única: build do Vite + servidor Node (sinalização, relay, API e arquivos estáticos).
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_ICE_SERVERS
ENV VITE_ICE_SERVERS=${VITE_ICE_SERVERS}
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4444 DB_PATH=/data/quadro.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY shared ./shared
VOLUME /data
EXPOSE 4444
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
