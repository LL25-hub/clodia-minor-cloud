# Clodia Minor - Gestione Appartamenti (Cloud)

Versione cloud del gestionale **Clodia Minor**:
- **Frontend**: HTML + Bootstrap statico (`public/`)
- **Backend**: Express + Node.js come funzione serverless su Vercel (`api/index.js`)
- **Database**: Supabase (PostgreSQL)

## Variabili d'ambiente richieste su Vercel

| Variabile | Valore |
|-----------|--------|
| `SUPABASE_URL` | URL del progetto Supabase |
| `SUPABASE_KEY` | Publishable/anon key del progetto |

## Sviluppo locale

```bash
npm install
npm run dev   # richiede Vercel CLI
```

## Deploy

Deploy automatico via push su GitHub (connesso a Vercel).

## Struttura

```
clodia-minor-cloud/
├── api/index.js         # Serverless Express app (handler)
├── public/              # Frontend statico (servito da Vercel)
├── server/
│   ├── db.js            # Client Supabase condiviso
│   ├── middleware/      # Validatori
│   └── routes/          # Endpoint REST
├── vercel.json          # Rewrites /api/* → /api/index
└── package.json
```

## Licenza

© 2025 Clodia Minor Team
