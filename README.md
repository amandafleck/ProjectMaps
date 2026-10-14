# Rota — Planejador de viagens

Base inicial do planejador de viagens com React, Leaflet, Node/Express e Geoapify. Nesta etapa, os lugares salvos ficam apenas na memória do navegador; não há banco de dados conectado.

## Requisitos

- Node.js 18 ou superior
- Uma chave gratuita da Geoapify para pesquisar destinos e lugares

O mapa usa tiles do OpenStreetMap e pode ser aberto sem chave da Geoapify. Para busca de destinos e pontos de interesse, configure a chave no backend:

1. Copie `server/.env.example` para `server/.env` (o arquivo de exemplo não é carregado automaticamente).
2. Substitua `cole_sua_chave_aqui` pela sua chave da Geoapify.
3. Reinicie o servidor com `npm run dev` após criar ou alterar `server/.env`.
4. Não compartilhe nem envie esse arquivo; ele está excluído pelo `.gitignore`.

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
- Mapa interativo com marcadores dos resultados.
- Salvamento e remoção de lugares na lista local da sessão.
- Inclusão de um ponto manual clicando no mapa e dando um nome.

Rotas da API: `GET /api/health`, `GET /api/geocode?text=...` e `GET /api/places?lat=...&lon=...&category=tourism`.
