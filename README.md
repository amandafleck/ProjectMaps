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

## Funcionalidades incluídas

- Pesquisa de destino via Geoapify Geocoding API.
- Busca de atrações, restaurantes, hotéis e parques próximos via Places API.
- Exibição de descrição e endereço para cada lugar encontrado.
- Salvamento de favoritos e marcação independente de vários lugares no mapa.
- Mapa interativo com marcadores dos resultados.
- Inclusão de vários pontos manuais clicando no mapa e dando um nome.

Rotas da API: `GET /api/health`, `GET /api/geocode?text=...` e `GET /api/places?lat=...&lon=...&category=tourism`.
