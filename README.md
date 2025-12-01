# Fractal Chat

**Fractal Chat** is an AI-powered reader application that enables users to interact with their documents (PDFs, EPUBs) using advanced RAG (Retrieval-Augmented Generation) techniques. It features a modern, responsive UI, secure authentication, group collaboration, and subscription billing.

## Features

- **🤖 AI Chat**: Intelligent chat interface powered by OpenAI and Vercel AI SDK.
- **📚 Document Intelligence**:
  - Support for PDF and EPUB formats.
  - Automatic text extraction, chunking, and embedding generation.
  - Semantic search to retrieve relevant context for answers.
- **📝 Annotations & Collaboration**:
  - Highlight and annotate documents.
  - Share documents and collaborate in groups.
  - Granular permission system (Owner, Viewer).
- **🔐 Authentication**: Secure user authentication via Better Auth (Google OAuth, Email/Password).
- **💳 Billing**: Integrated Stripe subscription management (Free vs Pro plans).
- **👥 Groups**: Create groups to manage shared resources and team access.

## Tech Stack

- **Framework**: [React Router v7](https://reactrouter.com/) (formerly Remix)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **AI/LLM**: [Vercel AI SDK](https://sdk.vercel.ai/), OpenAI
- **Storage**: [Supabase Storage](https://supabase.com/storage)
- **Auth**: [Better Auth](https://better-auth.com/)
- **Payments**: [Stripe](https://stripe.com/)

## Prerequisites

- **Node.js**: v20+ recommended
- **Bun**: (Optional) Used for faster package management and script execution.
- **Docker**: (Optional) For running a local PostgreSQL instance.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fractal_chat"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="your_generated_secret"
BETTER_AUTH_URL="http://localhost:5173" # or your production URL

# OAuth Providers
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# AI
OPENAI_API_KEY="sk-..."

# Storage (Supabase)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
SUPABASE_BUCKET="documents" # Default bucket for document storage

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PRICE_ID="price_..." # ID for the Pro subscription plan
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd fractal-chat
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   bun install
   ```

3. **Set up the database**

   If you don't have a Postgres instance, you can use Docker:

   ```bash
   docker run --name fractal-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   ```

   Run migrations to push the schema to your database:

   ```bash
   npm run drizzle-kit push
   # or
   bun run drizzle-kit push
   ```

4. **Start the development server**

   ```bash
   npm run dev
   # or
   bun run dev
   ```

   The app will be available at `http://localhost:5173`.

## Scripts

- `dev`: Start the development server.
- `build`: Build the application for production.
- `start`: Start the production server.
- `typecheck`: Run TypeScript type checking.
- `vercel-build`: Custom build script for Vercel deployment.

## Deployment

The application is built with React Router v7 and can be deployed to any platform that supports Node.js or Docker.

### Docker

```bash
docker build -t fractal-chat .
docker run -p 3000:3000 fractal-chat
```

### Vercel

This project is configured for Vercel. Ensure you set the environment variables in your Vercel project settings.

---

Built with ❤️ using React Router.
