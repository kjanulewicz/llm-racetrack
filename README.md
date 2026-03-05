# llm-racetrack

An internal tool for side-by-side comparison of multiple Large Language Models deployed on Azure. Submit a single text prompt, select two to four models (Azure OpenAI or Azure AI Foundry), and watch them race to complete the response in parallel. Each model runs with its own system prompt and endpoint. Results include streaming output, token metrics (prompt / cached / completion), time-to-first-token, and total elapsed time. Race history is persisted per user in Cosmos DB and shareable with colleagues in the same Entra ID tenant.

## Architecture

```
Browser (React + Vite)
  |  MSAL.js login (Entra ID, single-tenant)
  |  Bearer token (JWT) on every API request
  v
FastAPI Backend (Python 3.11+)
  |  Validate JWT (azure-identity / PyJWT)
  |  Extract user OID from token claims
  |
  |-- GET  /me/models          --> Cosmos DB (user model configs)
  |-- GET  /me/prompts         --> Cosmos DB (user prompt templates)
  |-- POST /race               --> asyncio.gather to Azure endpoints
  |   |-- Azure OpenAI           auth: DefaultAzureCredential
  |   |-- Azure AI Foundry       auth: DefaultAzureCredential
  |   SSE stream back to browser
  |-- POST /race/{id}/share    --> Cosmos DB (write share record)
  |-- GET  /me/history         --> Cosmos DB (user race history)
  |
  v
Azure Cosmos DB (serverless, NoSQL)
  Collections: users | model_configs | prompt_templates | races | shares
```

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 20+ |
| Terraform | 1.7+ |
| Azure CLI | latest (`az login` required) |

All Azure service authentication uses `DefaultAzureCredential`. Locally this resolves via `az login`; in production it resolves via Managed Identity. No API keys or secrets are stored anywhere.

## Quickstart

Commands from the developer quickstart (section 14 of the brief).

```bash
# 1. Clone
git clone https://github.com/your-org/llm-racetrack
cd llm-racetrack

# 2. Log in to Azure (one command — covers all Azure calls)
az login
# If your org uses multiple tenants, pin the correct one:
az login --tenant <your-tenant-id>

# 3. Backend
cd app/backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — fill in the four non-secret values:
#   TENANT_ID, API_CLIENT_ID, COSMOS_URL, FRONTEND_ORIGIN

uvicorn main:app --reload --port 8000
# Backend is now at http://localhost:8000
# Swagger UI at http://localhost:8000/docs

# 4. Frontend (new terminal)
cd app/frontend
npm install
cp .env.example .env
# Edit .env — fill in:
#   VITE_ENTRA_CLIENT_ID, VITE_TENANT_ID, VITE_API_BASE_URL=http://localhost:8000

npm run dev
# App is at http://localhost:5173
# Log in with your org account — same SSO as production
```

## Terraform Deployment

Manual deploy from a local machine (section 16.5 of the brief — Phase 1).

**Prerequisites:** `az login` with an account that has `Owner` or `Contributor` + `User Access Administrator` on the target subscription. Terraform CLI installed. Entra ID App Registration created manually (see [One-Time Azure Setup](#one-time-azure-setup) below).

```bash
# 1. Infrastructure
cd infra
cp terraform.tfvars.example terraform.tfvars
# Fill in terraform.tfvars with real values

terraform init
terraform plan
terraform apply
# Save outputs — cosmos_url and app_service_url are needed in the next steps

# 2. Frontend build
cd ../app/frontend
npm ci && npm run build

# 3. Deploy backend
cd ../backend
zip -r deploy.zip . -x "*.pyc" -x "__pycache__/*" -x ".venv/*"
az webapp deploy \
  --resource-group <rg> \
  --name <app-service-name> \
  --src-path deploy.zip \
  --type zip

# 4. Deploy frontend
az staticwebapp deploy \
  --name <static-web-app-name> \
  --resource-group <rg> \
  --source ../frontend/dist/ \
  --token $(az staticwebapp secrets list --name <name> --query "properties.apiKey" -o tsv)
```

Terraform creates: Resource Group, App Service Plan, App Service (backend), Static Web App (frontend), Cosmos DB account (serverless) with all containers, and RBAC role assignments for the backend Managed Identity.

Terraform **does not** create: Entra ID App Registration, Azure AI Foundry workspaces, or Azure OpenAI deployments — these are assumed to exist.

## Environment Variables

### Backend (`app/backend/.env.example`)

| Variable | Description |
|----------|-------------|
| `TENANT_ID` | Entra ID tenant ID |
| `API_CLIENT_ID` | Entra ID App Registration client ID |
| `COSMOS_URL` | Cosmos DB account endpoint (e.g. `https://<account>.documents.azure.com`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin (default: `http://localhost:5173`) |
| `MODELS_CONFIG_PATH` | _(optional)_ Path to org-default models config (default: `config/models.config.json`) |

### Frontend (`app/frontend/.env.example`)

| Variable | Description |
|----------|-------------|
| `VITE_ENTRA_CLIENT_ID` | Entra ID App Registration client ID (same as backend `API_CLIENT_ID`) |
| `VITE_TENANT_ID` | Entra ID tenant ID |
| `VITE_API_BASE_URL` | Backend API URL (default: `http://localhost:8000`) |

No secrets are stored in `.env` files. All values are non-secret configuration. Azure credentials are resolved at runtime via `DefaultAzureCredential`.

## One-Time Azure Setup

These steps are performed once by an Azure admin before developers can use the tool.

### Entra ID App Registration (Azure Portal)

1. Create a **single-tenant** App Registration
2. Add redirect URIs: `http://localhost:5173` (local dev) and the production Static Web App URL
3. **Expose an API** → add scope: `api://<client-id>/Race.Access`
4. **API permissions** → add Microsoft Graph `User.Read.All` (application) → **grant admin consent**

### RBAC Roles for Developers

Each developer needs the following roles on shared dev resources (granted by Azure admin):

| Resource | Role |
|----------|------|
| Cosmos DB account | `Cosmos DB Built-in Data Contributor` |
| Azure AI Foundry workspace(s) | `Azure AI Developer` |
| Azure OpenAI resource(s) | `Cognitive Services OpenAI User` |

A single shared dev Cosmos DB account is sufficient for the whole team.

## Full Specification

See [LLM_Race_Brief.md](LLM_Race_Brief.md) for the complete technical and business brief.
