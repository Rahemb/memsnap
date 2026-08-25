# Screenshot Inbox

Turn forgotten screenshots into a searchable personal memory.

## Try the published app

The live application is available at [memsnap.lovable.app](https://memsnap.lovable.app).

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm
- The project's `.env` file with the required Supabase settings

From the project directory, install the dependencies and start the development server:

```sh
npm install
npm run dev
```

Open [http://localhost:8080/] in your browser. Vite may use a different port if `8080` is already occupied; use the local URL printed in the terminal.

### Optional: Bun

Bun is not required. If Bun is installed, the equivalent commands are:

```sh
bun install
bun run dev
```

## Other commands

```sh
npm run build    # Create a production build
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
```

## Stack

- TanStack Start (React 19, Vite)
- Tailwind CSS
- Supabase for Postgres, authentication, and storage
- AI vision analysis and semantic search
