# Rota — Planejador de viagens

Base inicial do planejador de viagens com React, Leaflet, Node/Express e Geoapify. Nesta etapa, os lugares salvos ficam apenas na memória do navegador; não há banco de dados conectado.

## Requisitos

- Node.js 18 ou superior
- Uma chave gratuita da Geoapify para pesquisar destinos e lugares

O mapa usa tiles do OpenStreetMap e pode ser aberto sem chave da Geoapify. Para busca de destinos e pontos de interesse, configure a chave no backend:

1. Copie `server/.env.example` para `server/.env` (o arquivo de exemplo não é carregado automaticamente) e configure `GEOAPIFY_API_KEY` com sua chave da Geoapify.
2. O servidor também aceita `API_KEY` no `.env` da raiz do projeto, para aproveitar uma configuração já existente. `GEOAPIFY_API_KEY` tem prioridade se ambas estiverem definidas.
3. Reinicie o servidor com `npm run dev` após criar ou alterar o arquivo.
4. Não compartilhe nem envie arquivos `.env`; eles estão excluídos pelo `.gitignore`.

## Executar

Na raiz do projeto:

```sh
npm install
npm install --prefix client
npm install --prefix server
npm run dev
```

Abra `http://localhost:5173`. O React roda na porta 5173 e a API Express na porta 3000.

## Funcionalidades incluídas (Fase 1 — MVP)

- **Sugestões de pesquisa** enquanto você digita (setas e Enter), via Geoapify Autocomplete; escolher uma sugestão abre direto o card do lugar.
- **Compartilhar viagem**: gera um link ou um arquivo `.rota.json` com os pontos e categorias e, à escolha, descrições, hospedagem com distâncias e as rotas traçadas. Quem abre recebe uma cópia própria, editável. Os links ficam em `server/data/shares/` (fora do git) e só funcionam onde o servidor estiver acessível; o arquivo funciona em qualquer lugar.

- **Várias viagens**: criar, renomear, trocar e excluir; cada uma com destino, categorias e lugares próprios.
- **Explorar**: pesquisa de destino, busca por categoria (atrações, praias, restaurantes, hospedagem, parques, museus) e busca livre por lugar/endereço, com prioridade para resultados perto do destino.
- **Pesquisar ≠ adicionar**: resultados são marcadores temporários (verdes); só viram marcadores permanentes, na cor da categoria, quando adicionados (botão, popup do mapa ou seleção múltipla).
- **Pré-visualização**: passar o mouse num resultado o destaca no mapa; clicar o centraliza.
- **Meus lugares**: categorias personalizadas (nome e cor), ocultar/exibir no mapa, trocar a categoria de um lugar, prioridade, "já visitei" e observações.
- **Pontos manuais**: clicando no mapa ou digitando coordenadas (`-27.60, -48.54`) na busca.
- **Distância entre dois pontos** (botão ↔): linha reta e distância/tempo reais pela rota, de carro, a pé ou de bicicleta, com o trajeto desenhado no mapa.
- Os dados ficam salvos no `localStorage` do navegador (ainda sem MongoDB — próximo passo é mover isso para o backend).

Rotas da API: `GET /api/health`, `GET /api/geocode?text=...`, `GET /api/places?lat=...&lon=...&category=tourism`, `GET /api/search?text=...&lat=...&lon=...` `POST /api/route`, `GET /api/suggest`, `POST /api/shares` e `GET /api/shares/:id` (`{ mode, waypoints: [{lat, lon}] }`).

## Deploy na Vercel

O `vercel.json` define dois serviços no mesmo projeto: `app` (o Vite, em `client/`) e `server` (o Express, em `server/`). Pedidos a `/api/*` vão para o servidor e o resto para o app; o servidor recebe o caminho original, com o prefixo `/api`.

1. Importe o repositório na Vercel (o preset de serviços é detectado pelo `vercel.json`).
2. Em *Settings → Environment Variables*, crie `GEOAPIFY_API_KEY` (o `.env` local não vai para a Vercel).
3. Links de compartilhamento ainda **não funcionam** na Vercel: o disco de lá é temporário. Falta escolher um armazenamento (Vercel Blob, Redis ou MongoDB). Até lá, use o KML ou o backup (.json).
