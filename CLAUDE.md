# Projeto 2 — Quadro branco colaborativo em tempo real (WebRTC + CRDTs)

**Trilha:** 🌐 Trilha de Desenvolvimento Web · **Catálogo:** `../Projetos_Portfolio_Claude_Code.md` · **Agenda:** `../AGENDA.md`

## Regras de trabalho (valem para esta pasta)

- Responder em português (pt-BR). Ler também `~/CONTEXTO_CLAUDE.md` (regras de privacidade de IP, sudo via `sudo -A` + zenity, etc.).
- Ritmo: **um projeto por dia**. O catálogo estima semanas; aqui o alvo do dia é um **MVP funcional, testado e versionado**, com o restante listado em "Próximos passos" no README.
- Fluxo: planejar → aprovação do usuário → implementar em fases, commits pequenos (Conventional Commits), testes ao fim de cada fase.
- Segredos só em `.env` (com `.env.example`). Chaves de API são digitadas numa janela `zenity` que grava direto no `.env`; nunca pedir para colar no chat.
- Ao terminar a sessão, atualizar a seção **Estado e diário** abaixo e a linha do projeto em `../AGENDA.md`.

## Comandos

- `npm run dev`: Vite em http://localhost:5173 + servidor em 4444 (proxy de `/api`, `/sync`, `/signal`). Encerrar ao fim do dia.
- `npm run build && npm start`: produção, tudo em http://localhost:4444 (o servidor serve o `dist/`).
- `npm test`: Vitest (unitários + integração com servidor real em porta aleatória e banco `:memory:`).
- `npm run test:e2e`: Playwright (build + servidor na porta 4555, `data/e2e.db`; local usa o Chrome do sistema).
- `npm run lint` · `npm run typecheck` (app e servidor separados) · `npm run format` / `format:check`.
- `docker compose up --build`: escrito, **não testado** (o notebook não tem Docker).

## Arquitetura e convenções

- **Cliente:** React 19 + Vite 8 + Canvas 2D puro. `shared/board.ts` (classe `Board`) é a única porta de escrita no `Y.Doc`: cada elemento é um `Y.Map` dentro de `doc.getMap('elements')`; geometria sempre em `points` (lista plana). Toda escrita local usa `board.origin` (só ela entra no `Y.UndoManager`); `board.commit()` fecha o grupo do desfazer ao fim do gesto.
- **Sync (`src/sync/connection.ts`):** IndexedDB + `WebsocketProvider` (relay) + `WebrtcProvider` (só editor), todos no mesmo `Y.Doc` e na mesma `Awareness`.
- **Servidor (`server/`):** Node 22 roda `.ts` direto (type stripping): só sintaxe apagável (`erasableSyntaxOnly`), imports com extensão `.ts`, sem enums/parameter properties. Uma porta: `/api` (salas, links, snapshots), `/sync/<sala>?t=` (relay y-websocket que descarta updates de leitor), `/signal?room=&t=` (sinalização y-webrtc, só editor e só o tópico `quadro-<sala>`).
- **Links:** token `<papel>.<HMAC>` sem estado (`server/tokens.ts`), segredo `ROOM_SECRET` no `.env`. Rota do cliente no hash: `#sala=<id>&t=<token>`.
- **Banco:** `node:sqlite` (experimental no Node 22; o aviso é silenciado com `--disable-warning=ExperimentalWarning`). Trocas para Postgres ficam em `server/store.ts`.
- **Versões fixadas:** TypeScript 6.0 (o typescript-eslint ainda não aceita o 7), y-websocket 3.1 só no cliente (o `@y/websocket-server` exige Yjs 14).
- Commits: Conventional Commits, autor Gabriel Nogueira <gabrielnbn@ufba.br> (config local do repositório).

## Divulgação ao fim do dia (padrão da série)

Instagram/Facebook do usuário: **@ideia_enegocios**.

**Objetivo da divulgação: atrair clientes** que querem um site novo ou melhorar o site/sistema que já têm (público: donos de negócio, não programadores). Textos e vídeo falam do **benefício para o negócio do cliente** (vender mais, atender melhor, segurança, velocidade, economia), com linguagem simples, e terminam com chamada para o direct. Modelo aprovado pelo usuário em 15/10/2026: P01 (`video/reel.config.json` e `video/LEGENDA_INSTAGRAM.txt`): abertura com benefício ("Um site que se adapta a cada cliente"), legendas das cenas de código traduzidas em benefício ("Testado a cada mudança: seu site não quebra"), encerramento de venda (aprovado): "Quer um site assim?" + lista de serviços com check ("Criação de sites", "Reforma do seu site atual", "Mais clientes pela internet") + botão pulsando "Me chama no direct" + @ideia_enegocios, com 4,5 s de duração.

Ao concluir o MVP do dia, sem o usuário precisar pedir:

1. **Texto do post:** já existe em `POST_REDES_SOCIAIS.md` (nesta pasta). Revisar contra o que realmente ficou pronto (não anunciar função que não existe) e copiar o texto para `video/LEGENDA_INSTAGRAM.txt`.
2. **Reel de 30 s** (formato 9:16): criar `video/reel.config.json` (modelo: `../P01_portfolio-ia-recrutador/video/reel.config.json`) com 3 trechos **reais e centrais** do código deste projeto + o app rodando, e renderizar com `../_video/gerar-reel.mjs` (ver `../_video/README.md`): rascunho, conferir quadros, depois o final. Abertura com "Dia 2 de 22"; encerramento com o @.
3. Pôr `video/.build/` e `video/*.mp4` no `.gitignore` do projeto; o `reel.config.json` e a legenda vão para o git.
4. Avisar o usuário onde estão `video/reel.mp4`, `video/capa.jpg` e `video/LEGENDA_INSTAGRAM.txt`.

## Restrições do notebook (verificadas em 14/10/2026)

- Linux Mint 22.3, i5-4210U, **8 GB de RAM** (≈3 GB livres com VS Code e Chrome abertos), 170 GB livres.
- Instalados: Node 22, npm 10, Python 3.12, git 2.43, gh 2.45 (logado).
- **Não instalados:** Docker, pnpm, PostgreSQL. Instalar Docker/Postgres exige sudo e, no modo automático, pode ser bloqueado: pedir ao usuário o modo manual. Preferir alternativas leves (SQLite/PGlite local, serviços gerenciados gratuitos) quando o prompt pedir Docker Compose, e documentar a troca.
- Evitar deixar servidores de desenvolvimento rodando ao fim do dia (pressão de RAM).

**Nível:** Avançado · **Tempo:** 3–5 semanas

**Objetivo:** Whiteboard multiusuário estilo Excalidraw/Miro com sincronização sem conflitos usando CRDTs, comunicação P2P via WebRTC e servidor de sinalização.

**Stack:** React + TypeScript + Vite, Canvas 2D (ou Konva), Yjs (CRDT) + y-webrtc, servidor de sinalização Node (ws), fallback y-websocket, persistência em IndexedDB (y-indexeddb) e Postgres para snapshots.

**Funcionalidades:**

- Ferramentas: caneta livre, formas, texto, seta, borracha, seleção/mover
- Cursores e presença dos usuários em tempo real (awareness do Yjs)
- Funciona offline e reconcilia ao reconectar
- Salas por link compartilhável com permissões (editor/leitor)
- Undo/redo por usuário (Y.UndoManager)
- Exportar PNG/SVG e histórico de versões (snapshots)

**Observações:**

- Explique no README por que CRDT e não OT — recrutadores adoram esse trade-off
- WebRTC precisa de STUN/TURN; documente a limitação de NAT simétrico
- Teste com 2 abas + throttling de rede no DevTools
- Grave um GIF com 3 usuários simultâneos para o portfólio

## Prompt original (do catálogo)

```text
Você é um engenheiro de software sênior. Vamos construir o projeto "Quadro branco colaborativo em tempo real (WebRTC + CRDTs)" (Trilha Desenvolvimento Web) como peça de portfólio com qualidade de produção.

OBJETIVO
Whiteboard multiusuário estilo Excalidraw/Miro com sincronização sem conflitos usando CRDTs, comunicação P2P via WebRTC e servidor de sinalização.

STACK SUGERIDA (pode propor ajustes justificando)
React + TypeScript + Vite, Canvas 2D (ou Konva), Yjs (CRDT) + y-webrtc, servidor de sinalização Node (ws), fallback y-websocket, persistência em IndexedDB (y-indexeddb) e Postgres para snapshots.

FUNCIONALIDADES OBRIGATÓRIAS
1. Ferramentas: caneta livre, formas, texto, seta, borracha, seleção/mover
2. Cursores e presença dos usuários em tempo real (awareness do Yjs)
3. Funciona offline e reconcilia ao reconectar
4. Salas por link compartilhável com permissões (editor/leitor)
5. Undo/redo por usuário (Y.UndoManager)
6. Exportar PNG/SVG e histórico de versões (snapshots)

CUIDADOS E REQUISITOS NÃO FUNCIONAIS
- Explique no README por que CRDT e não OT — recrutadores adoram esse trade-off
- WebRTC precisa de STUN/TURN; documente a limitação de NAT simétrico
- Teste com 2 abas + throttling de rede no DevTools
- Grave um GIF com 3 usuários simultâneos para o portfólio
- Tipagem estrita, lint e formatação configurados
- Testes automatizados (unitários + integração; E2E nos fluxos críticos)
- Docker Compose para subir tudo localmente com um comando
- Segredos apenas em .env (com .env.example)
- CI no GitHub Actions rodando lint, testes e build

COMO TRABALHAR
1. ANTES de codar, entre em modo de planejamento: arquitetura, estrutura de pastas, modelo de dados e plano em fases (MVP primeiro). Aguarde minha aprovação.
2. Crie um CLAUDE.md com visão, comandos, convenções e decisões de arquitetura.
3. Implemente fase por fase, commits pequenos (Conventional Commits), rodando testes ao fim de cada fase.
4. Ao final, gere README.md: problema, demo, diagrama Mermaid, como rodar, trade-offs, limitações e próximos passos.
5. Se algo for ambíguo, pergunte em vez de supor.

Comece apresentando o plano da Fase 1.
```

## Estado e diário

- **Status:** não iniciado.
