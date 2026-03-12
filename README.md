# MyIdeas Frontend

Aplicação frontend do **MyIdeas**, construída com:

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui
- React Router
- React Query

## Rodando em desenvolvimento

```bash
cd frontend
npm install
npm run dev
```

Por padrão o app sobe em `http://localhost:8080`.

## Build para produção

```bash
npm run build
```

Os arquivos finais ficam em `dist/`.

## Estrutura principal

- `src/pages` – telas (`Login`, `Register`, `Ideas`, `Chat`, etc.)
- `src/components` – componentes reutilizáveis e UI do shadcn
- `src/contexts/AuthContext.tsx` – contexto de autenticação
- `src/services/api.ts` – cliente HTTP que conversa com o backend FastAPI

O backend vive na pasta `../backend` e expõe a API consumida por este frontend.
