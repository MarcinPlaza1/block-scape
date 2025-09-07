# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/965a9cad-5340-4a55-95a0-68c5a3808afb

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/965a9cad-5340-4a55-95a0-68c5a3808afb) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Authentication Setup

This project includes a secure authentication system:

- JWT access tokens (short-lived)
- httpOnly refresh tokens stored as cookies and persisted in the database
- Passwords hashed with bcrypt
- Role support (USER, ADMIN)

### Environment variables

Create a `.env` file in the repo root with for example:

```
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:8080
BACKEND_ORIGIN=http://localhost:3001

# SQLite path relative to repo root
DATABASE_URL=file:./server/prisma/server/prisma/dev.db

JWT_ACCESS_SECRET=replace-with-strong-random-string
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
REFRESH_COOKIE_NAME=refresh_token
```

### Install & run

```
npm i
npm run db:generate
npm run server
npm run dev
```

The frontend proxies `/api` to the backend and will auto-refresh access tokens when they expire.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/965a9cad-5340-4a55-95a0-68c5a3808afb) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
