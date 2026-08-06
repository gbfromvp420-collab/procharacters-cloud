# Monorepo note

Root `railway.toml` was removed so GitHub deploys do not force the backend Dockerfile on both services.  
Set Dockerfile path **per service** in the Railway dashboard:

| Service | Dockerfile |
|---------|------------|
| `procharacters-api` | `backend/Dockerfile` |
| `procharacters-web` | `frontend/Dockerfile` |

See [docs/DEPLOY.md](./docs/DEPLOY.md).

---

# Ops from Grok (CLI + MCP)

**CLI on this machine:** `railway` at `/root/.local/bin/railway` (v4.5.3, arm64).  
**Grok MCP:** server `railway` → `npx -y @jasontanswe/railway-mcp` (38 tools once token is set).

## One-time auth (stay in this chat)

1. Create token: https://railway.app/account/tokens  
2. Paste here as `RAILWAY_API_TOKEN=…` (do not commit)  
3. Eng exports:
   ```bash
   export RAILWAY_API_TOKEN='…'
   export RAILWAY_TOKEN="$RAILWAY_API_TOKEN"
   ```
4. Then King Grok can set Stripe vars, redeploy, and read logs without you leaving the window.

Stripe keys → **API** service only — [docs/ops-billing-stripe.md](./docs/ops-billing-stripe.md).
