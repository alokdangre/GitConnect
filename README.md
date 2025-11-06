# GitConnect

GitConnect is an AI-powered platform that analyzes open-source contributions, personal repositories, and GitHub activities to surface intelligent insights for developers, recruiters, and collaborators.

## Key Capabilities

- **Developer intelligence:** Build skill maps, contribution summaries, and growth trajectories enriched with LLM insights.
- **Repository analytics:** Benchmark competitiveness, surface trends, and evaluate project health using hybrid Elastic search signals.
- **Personalized updates:** Generate daily, ready-to-post content for platforms like X and LinkedIn based on your activity.
- **Smart recommendations:** Discover relevant repositories, collaborators, jobs, and learning resources tailored to your profile.

The project is under active development. The backend service lives in `backend/` and currently exposes a simple Express server scaffold as the foundation for future APIs.

## Quick Start with Docker Compose

### Prerequisites
- Docker and Docker Compose installed

### Setup
1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd GitConnect
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your GitHub OAuth credentials
   ```

3. **Start all services**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

### GitHub OAuth Setup
1. Create a GitHub OAuth App at https://github.com/settings/developers
2. Set Authorization callback URL to: `http://localhost:3000/auth/callback`
3. Add Client ID and Client Secret to `.env` file

## Manual Development Setup

If you prefer to run services individually:

### Backend Setup
```bash
cd backend
cp .env.example .env
# Configure DATABASE_URL and GitHub credentials
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env.local
# Configure GitHub Client ID
npm install
npm run dev
```

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up --build --force-recreate
```
