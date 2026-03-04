# llm-racetrack — Technical & Business Brief

> Document version: 2.1  
> Prepared for: GitHub Copilot Workspace  
> Stack: Python / FastAPI + React (Vite) + Azure Entra ID (single-tenant) + Azure Cosmos DB + Azure Managed Identity

---

## 1. Business Overview

llm-racetrack is an internal organisational tool that enables side-by-side comparison of multiple Large Language Models deployed on Azure. A user submits a single text prompt, selects two to four models, and watches each model "race" to complete the response. Each model runs with its own independently configured system prompt and Azure AI endpoint.

Each user has a personal workspace: their own model configurations (including Azure AI Foundry resource URLs), saved system prompt templates, race history, and UI preferences. Results can be shared with colleagues within the same Azure AD tenant by email invitation.

**Primary use cases:**
- Evaluating response quality across model families (GPT-4o vs Mistral vs Llama)
- Benchmarking latency and cost (token consumption) of competing models
- Prompt engineering: testing different system prompts on the same user input
- Sharing benchmark results with stakeholders via a read-only shared view
- Internal demos and presentations

**Key differentiators from manual testing:**
- Parallel execution — all models run simultaneously, not sequentially
- Unified token reporting — input tokens, cached tokens, output tokens per model
- Visual race metaphor — makes performance differences instantly intuitive
- Per-user model configuration — each user manages their own Azure AI Foundry endpoints
- Persistent history — every race is saved and replayable
- Org-wide sharing — results shareable to any colleague in the Azure AD tenant

---

## 2. Functional Requirements

| ID | Requirement |
|----|-------------|
| F-01 | User enters a single text input (user message) |
| F-02 | User can select 2 to 4 models to race (at least 2 required to start) |
| F-03 | Each model has its own system prompt, editable live in the UI |
| F-04 | All selected models are called in parallel |
| F-05 | Each model response streams back as it completes |
| F-06 | UI displays a Three.js animated race for the duration of each model's response |
| F-07 | Final results show: response text, time to first token, total elapsed time |
| F-08 | Token metrics displayed per model: prompt tokens, cached tokens, completion tokens, total |
| F-09 | A base set of models is defined in `models.config.json` (org-wide defaults) |
| F-10 | Users can add new model slots in the UI via a "+" button (max 4 active) |
| F-11 | Users can remove model slots via an "x" button (minimum 2 must remain) |
| F-12 | For Azure AI Foundry models, the user selects the endpoint URL in the UI (per model slot) |
| F-13 | User can browse and select their available Azure AI Foundry resources and subscriptions in the UI |
| F-14 | System prompts are editable in the UI; saved templates persist per user in Cosmos DB |
| F-15 | Users log in via Azure Entra ID (single-tenant, organisation SSO) |
| F-16 | Each user has a personal profile: model configs, prompt templates, preferences |
| F-17 | Every completed race is saved to the user's race history in Cosmos DB |
| F-18 | Race history is viewable as a list with replay (no re-run — displays saved data) |
| F-19 | A user can share a race result with a colleague by entering their organisational email |
| F-20 | The recipient receives an in-app notification; the shared result appears in their "Shared with me" view |
| F-21 | Sharing is restricted to users in the same Azure AD tenant (validated server-side) |
| F-22 | Azure Managed Identity is used for all Azure API authentication in production |
| F-23 | Local development supports `az login` without any `.env` file |
| F-24 | The entire UI visual language follows an arcade 2D racing game aesthetic (see section 9) |

---

## 3. Non-Functional Requirements

- Response streaming: models stream tokens to the frontend via Server-Sent Events (SSE)
- Parallel execution: backend fires all model calls concurrently using `asyncio.gather`
- Authentication: all API routes require a valid Entra ID JWT; no anonymous access
- Data isolation: Cosmos DB queries always scope to the authenticated user's `oid` claim
- Extensibility: adding a new org-default model requires only a new entry in `models.config.json`
- No secrets in code: all Azure credentials via Managed Identity; no API keys stored anywhere

---

## 4. Architecture

```
Browser (React + Vite)
  |  MSAL.js login (Entra ID, single-tenant)
  |  Bearer token (JWT) on every API request
  v
FastAPI Backend (Python 3.11+)
  |  Validate JWT (azure-identity / PyJWT)
  |  Extract user OID from token claims
  |
  |-- GET /me/models            --> Cosmos DB (user model configs)
  |-- GET /me/prompts           --> Cosmos DB (user prompt templates)
  |-- POST /race                --> asyncio.gather to Azure endpoints
  |   |-- Azure OpenAI          auth: DefaultAzureCredential
  |   |-- Azure AI Foundry      auth: DefaultAzureCredential
  |   SSE stream back to browser
  |-- POST /race/{id}/share     --> Cosmos DB (write share record)
  |-- GET /me/history           --> Cosmos DB (user race history)
  |
  v
Azure Cosmos DB (serverless, NoSQL)
  Collections: users | races | shares | prompt_templates
```

---

## 5. Identity & Authentication

### 5.1 User Login — MSAL.js (frontend)

The frontend uses `@azure/msal-react` to authenticate users against the organisation's Azure AD tenant.

```javascript
// msal.config.js
{
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_TENANT_ID}`,
    redirectUri: window.location.origin
  }
}
```

Flow:
1. On app load: check for existing session via `useMsal()`
2. If unauthenticated: redirect to Entra ID login (org SSO — no separate password)
3. Acquire token silently for the backend API scope
4. Attach `Authorization: Bearer <token>` on every `fetch` call

### 5.2 Backend JWT Validation

Every FastAPI route is protected by a dependency that:
1. Extracts the `Authorization` header
2. Validates the JWT signature against the tenant's JWKS endpoint
3. Verifies `aud`, `iss`, and `tid` claims match the configured tenant
4. Returns the user's `oid` (object ID) — used as the partition key in Cosmos DB

```python
# auth/jwt_validator.py
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserClaims:
    payload = validate_entra_token(token, tenant_id=settings.TENANT_ID, audience=settings.API_CLIENT_ID)
    return UserClaims(oid=payload["oid"], email=payload["preferred_username"], name=payload["name"])
```

### 5.3 Sharing — Entra-scoped

When a user shares a race by email:
1. Backend calls **Microsoft Graph API** (`GET /users?$filter=mail eq '{email}'`) to resolve the email to an Entra OID
2. Validates the resolved user is in the same tenant (`tid` must match)
3. Writes a `share` document to Cosmos DB: `{ race_id, owner_oid, recipient_oid, shared_at }`
4. The recipient sees the shared race in `GET /me/shared` — queried by their OID as `recipient_oid`

Graph API call uses the backend's Managed Identity with `User.Read.All` permission granted.

### 5.4 Local Development Auth

Local development connects to **real Azure resources** — no mocks, no emulators. The only difference from production is that `DefaultAzureCredential` resolves credentials from `az login` (Azure CLI) instead of Managed Identity. The same code runs in both environments without any changes.

| Scenario | Production | Local |
|----------|-----------|-------|
| User login (frontend) | MSAL.js → Entra ID | Same — developer logs in with their org account at `localhost:5173` |
| Backend JWT validation | Validates Entra JWT | Same code path — token comes from the real Entra tenant |
| Azure OpenAI / Foundry calls | Managed Identity → `DefaultAzureCredential` | `az login` → `DefaultAzureCredential` (automatic fallback, zero code change) |
| Graph API (share resolution) | Managed Identity + `User.Read.All` app permission | Developer's Entra identity — needs `User.Read.All` delegated, or a shared dev Service Principal |
| Cosmos DB | Managed Identity + RBAC | Developer's identity granted `Cosmos DB Built-in Data Contributor` on the dev Cosmos account |
| Azure AI Foundry endpoint | URL from user's saved model config in Cosmos | Same — developer enters their real Foundry URL in the UI during local testing |

**What each developer needs (one-time, granted by Azure admin):**
- Access to at least one Azure AI Foundry workspace (`Azure AI Developer` role or higher)
- Access to the shared dev Cosmos DB account (`Cosmos DB Built-in Data Contributor`)
- `User.Read.All` on Microsoft Graph (delegated) for share functionality — or use a shared dev Service Principal

**No secrets in `.env`.** The only `.env` values needed locally are non-secret configuration:
```
TENANT_ID=<your-org-tenant-id>
API_CLIENT_ID=<app-registration-client-id>
COSMOS_URL=https://<dev-cosmos-account>.documents.azure.com
FRONTEND_ORIGIN=http://localhost:5173
```

`DefaultAzureCredential` resolution order locally:
1. Environment variables (Service Principal — only if explicitly set)
2. **Azure CLI (`az login`)** — the standard path for developers
3. Visual Studio Code credentials
4. Managed Identity (skipped locally, active in production)

---

## 6. Data Model — Cosmos DB

### Collection: `users`
```json
{
  "id": "<oid>",
  "partitionKey": "<oid>",
  "email": "user@org.com",
  "name": "Jan Kowalski",
  "preferences": {
    "theme": "arcade-dark",
    "default_model_ids": ["gpt-4o", "mistral-large"]
  },
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Collection: `model_configs`
One document per user-configured model slot. Users can have multiple configs for the same base model (e.g. two different Foundry endpoints).

```json
{
  "id": "<uuid>",
  "partitionKey": "<user_oid>",
  "user_oid": "<oid>",
  "base_model_id": "mistral-large",
  "label": "Mistral Large (EU West)",
  "provider": "azure_foundry",
  "endpoint_url": "https://my-foundry-eu.inference.ai.azure.com",
  "subscription_id": "<azure-sub-id>",
  "resource_group": "my-rg",
  "color": "#f97316",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Collection: `prompt_templates`
```json
{
  "id": "<uuid>",
  "partitionKey": "<user_oid>",
  "user_oid": "<oid>",
  "name": "Concise analyst",
  "content": "You are a concise analyst. Answer in bullet points only.",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Collection: `races`
```json
{
  "id": "<uuid>",
  "partitionKey": "<user_oid>",
  "user_oid": "<oid>",
  "user_input": "Explain quantum entanglement",
  "run_at": "2025-01-01T12:00:00Z",
  "results": [
    {
      "model_config_id": "<uuid>",
      "label": "GPT-4o",
      "system_prompt": "You are helpful.",
      "response_text": "Quantum entanglement is...",
      "elapsed_ms": 3241,
      "ttft_ms": 312,
      "usage": {
        "prompt_tokens": 42,
        "cached_tokens": 0,
        "completion_tokens": 187
      },
      "finish_position": 1
    }
  ]
}
```

### Collection: `shares`
```json
{
  "id": "<uuid>",
  "partitionKey": "<recipient_oid>",
  "race_id": "<uuid>",
  "owner_oid": "<oid>",
  "owner_name": "Jan Kowalski",
  "recipient_oid": "<oid>",
  "shared_at": "2025-01-01T12:05:00Z"
}
```

---

## 7. Azure AI Foundry — Endpoint Selection in UI

Users configure their own Azure AI Foundry endpoint URLs directly in the model slot UI. This is necessary because different users may have access to different subscriptions and resource groups.

### 7.1 Manual URL entry
The simplest path: in the model slot editor, a text field accepts the full inference endpoint URL (`https://<resource>.inference.ai.azure.com`). The user pastes this from the Azure portal.

### 7.2 Assisted resource picker (recommended)
If the user has Azure subscriptions accessible under their Entra identity, the backend can enumerate resources via Azure Resource Management API:

```
GET /azure/foundry-resources
  --> calls Azure Resource Manager: GET /subscriptions?api-version=2022-12-01
  --> for each subscription: GET /resources?$filter=resourceType eq 'Microsoft.MachineLearningServices/workspaces'
  --> returns list: { subscription_id, subscription_name, resource_group, workspace_name, inference_endpoint }
```

The UI presents a two-level dropdown:
1. Select subscription
2. Select AI Foundry workspace within that subscription

Selecting a workspace auto-fills the endpoint URL. The user can still edit it manually.

**Auth note:** this endpoint uses the user's delegated token (not Managed Identity) so only workspaces the user has access to are returned. The backend forwards the user's Bearer token to ARM, scoped to `https://management.azure.com/.default`.

### 7.3 UI flow for adding a model slot with Foundry

```
[ + ADD MODEL ]
  -> opens modal: "Configure Model"
     Provider: [ Azure OpenAI ] [ Azure AI Foundry ]  <-- toggle
     
     If Azure AI Foundry:
       Subscription: [ dropdown — loaded from /azure/foundry-resources ]
       Workspace:    [ dropdown — filtered by selected subscription ]
       Endpoint URL: [ auto-filled, editable ]       <-- always visible/editable
       Model name:   [ text field e.g. Mistral-large-2411 ]
       Label:        [ text field e.g. "Mistral EU West" ]
       Color:        [ color picker — neon palette ]
     
     System Prompt: [ textarea ]
     [ Save to my models ] [ Cancel ]
```

Saved configs persist to `model_configs` collection in Cosmos DB.

---

## 8. Backend File Structure

```
backend/
  main.py
  settings.py                    # Pydantic BaseSettings: tenant_id, client_id, cosmos_url, etc.
  routers/
    race.py                      # POST /race (SSE stream)
    models.py                    # GET/POST/DELETE /me/models
    prompts.py                   # GET/POST/DELETE /me/prompts
    history.py                   # GET /me/history, GET /me/history/{id}
    shares.py                    # POST /race/{id}/share, GET /me/shared
    azure_resources.py           # GET /azure/foundry-resources
  services/
    azure_openai.py              # stream_completion for Azure OpenAI
    azure_foundry.py             # stream_completion for Azure AI Foundry
    race_runner.py               # asyncio.gather orchestrator + SSE builder
    graph.py                     # Microsoft Graph: resolve email -> OID
    arm.py                       # Azure Resource Manager: list Foundry workspaces
  auth/
    jwt_validator.py             # Entra JWT validation, UserClaims model
    credentials.py               # DefaultAzureCredential singleton
  db/
    cosmos_client.py             # Cosmos DB async client wrapper
    repositories/
      user_repo.py
      model_config_repo.py
      prompt_repo.py
      race_repo.py
      share_repo.py
  config/
    models.config.json           # Org-wide default models (seed data)
  models/
    schemas.py                   # All Pydantic schemas
  requirements.txt
  .env.example
```

---

## 9. Race Animation & Visual Design

### 9.1 Arcade Visual Identity

The entire application must feel like a 1990s arcade racing game.

**Typography**
- Primary font: `"Press Start 2P"` (Google Fonts) — all headings, labels, buttons
- Fallback: monospace. All caps preferred for UI chrome.

**Color palette**
- Background: `#0a0a1a` (near-black navy)
- Neon model colors (assignable): `#00ff88`, `#ff3cac`, `#ffee00`, `#3cf`
- UI panels: dark with neon border glow (`box-shadow: 0 0 12px <neon-color>`)
- No white backgrounds anywhere

**Pixel aesthetic**
- Car sprites: pixel art SVGs (16x8 px, upscaled with `image-rendering: pixelated`)
- 2px hard borders throughout, no border-radius except pill badges
- Scanline overlay on the race track (CSS `repeating-linear-gradient`)

**Animations**
- Neon flicker on model name labels (CSS `opacity` keyframe)
- Screen shake on race start
- "INSERT COIN" blink on idle state
- Pixel explosion / star burst on winner's finish

### 9.2 Three.js Race Track

- Orthographic camera, fixed top-down 2D view
- 2–4 lanes dynamically sized to active model count
- Chequered finish line: `PlaneGeometry` with repeating chequered canvas texture
- Scanline CSS overlay on the canvas wrapper

**Car progress formula:**
```
progress (running) = min(elapsed_ms / estimated_ceiling_ms, 0.95)
progress (done)    = 1.0

estimated_ceiling_ms = rolling average of user's last 3 races, default 20_000 ms
```

**Finish sequence:**
1. First `done`: confetti `Points` burst, "1ST PLACE" neon overlay
2. Subsequent: "2ND", "3RD", "4TH" in order
3. All done: grey out losers, unlock result cards

### 9.3 Model Slot Cards

Horizontal row, arcade "player select" style:
```
[ GPT-4o  x ]  [ Mistral EU  x ]  [ o3  x ]  [ + ADD ]
```
- Min 2, max 4 active. "x" disabled at min=2, "+" hidden at max=4.
- Each card: model label (neon), endpoint badge (Foundry URL truncated), system prompt preview, expand button.
- "+" opens the "Configure Model" modal (section 7.3).

### 9.4 HUD Layout

```
+--------------------------------------------------+
|  [LOGO: LLM-RACETRACK]         [user avatar / logout]  |
+--------------------------------------------------+
|  > YOUR PROMPT:                                   |
|  [ textarea ................................ ]     |
|  [ GPT-4o x ] [ Mistral x ] [ o3 x ] [ + ]       |
|  [         START RACE BUTTON          ]           |
+--------------------------------------------------+
|  RACE TRACK (Three.js canvas)                     |
|  lane 1: [car] -----> ...........| FINISH         |
|  lane 2: [car] -------->  .......| FINISH         |
|  lane 3: [car] ->.................| FINISH         |
+--------------------------------------------------+
|  RESULTS (appear as each model finishes)          |
|  [ card: GPT-4o | time | tokens | response | share] |
+--------------------------------------------------+
```

---

## 10. Frontend File Structure

```
frontend/
  src/
    auth/
      msal.config.js
      AuthProvider.jsx           # MSAL provider wrapper
      useAuth.js                 # current user, token acquisition
    components/
      InputPanel.jsx
      ModelSelector.jsx
      ModelSlotCard.jsx          # single slot card with x button
      AddModelModal.jsx          # "Configure Model" modal (section 7.3)
      FoundryResourcePicker.jsx  # subscription + workspace dropdowns
      SystemPromptEditor.jsx
      RaceTrack.jsx              # Three.js canvas
      ResultCard.jsx
      TokenBadge.jsx
      ShareModal.jsx             # email input + share button
      HistoryList.jsx
      HistoryReplay.jsx
      PromptTemplateDrawer.jsx   # saved prompt templates
    hooks/
      useRace.js
      useModels.js               # fetches /me/models
      useFoundryResources.js     # fetches /azure/foundry-resources
      useHistory.js
      usePromptTemplates.js
    utils/
      sse.js
      formatting.js
      api.js                     # fetch wrapper that attaches Bearer token
    pages/
      RacePage.jsx               # main race UI
      HistoryPage.jsx
      SharedPage.jsx             # "shared with me" view
      SettingsPage.jsx           # preferences + saved models + prompt templates
    App.jsx
    main.jsx
  index.html
  vite.config.js
  package.json
```

---

## 11. API Contract (updated)

### Auth header (all routes)
```
Authorization: Bearer <entra-jwt>
```

### GET /models/defaults
Returns org-wide default models from `models.config.json` (no auth required — public seed list).

### GET /me/models
Returns the authenticated user's saved model configurations from Cosmos DB.

### POST /me/models
Saves a new model configuration for the user.

### DELETE /me/models/{id}
Removes a user model configuration.

### GET /azure/foundry-resources
Returns Azure AI Foundry workspaces accessible to the user. Uses delegated token forwarded to ARM.

### POST /race
Starts a parallel race (SSE stream). Same event types as v1.0: `chunk`, `ttft`, `done`, `error`. On completion, backend automatically persists the race to Cosmos DB and returns `race_id` in the final `done` event.

```json
{
  "user_input": "...",
  "models": [
    {
      "model_config_id": "<uuid>",
      "system_prompt": "override or same as saved"
    }
  ]
}
```

### POST /race/{id}/share
```json
{ "recipient_email": "colleague@org.com" }
```
Resolves email via Graph API, validates same tenant, writes share record.

### GET /me/history
Returns list of past races (metadata only — no response text). Paginated.

### GET /me/history/{id}
Returns full race result for replay.

### GET /me/shared
Returns race results shared with the authenticated user.

---

## 12. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18 + Vite |
| Auth (frontend) | @azure/msal-react |
| Animation | Three.js r128 |
| Styling | Tailwind CSS + `"Press Start 2P"` font |
| Backend framework | FastAPI (Python 3.11+) |
| Async HTTP client | httpx (async) |
| Azure auth (backend) | azure-identity (DefaultAzureCredential) |
| JWT validation | PyJWT + azure-identity |
| Azure OpenAI client | openai Python SDK v1.x |
| Azure AI Foundry client | azure-ai-inference |
| Graph API client | httpx (direct REST calls) |
| ARM API client | httpx (direct REST calls, delegated token) |
| Database | Azure Cosmos DB (serverless, NoSQL, async SDK) |
| Streaming transport | Server-Sent Events (SSE) |
| Org-default config | `models.config.json` |

---

## 13. Task Breakdown for GitHub Copilot

### Phase 1 — Backend Foundation

**Task 1.1 — Project scaffold**
Create FastAPI project structure per section 8. Add `settings.py` using `pydantic-settings` to load: `TENANT_ID`, `API_CLIENT_ID`, `COSMOS_URL`, `COSMOS_KEY`, `FRONTEND_ORIGIN`. Add `requirements.txt`: fastapi, uvicorn, httpx, openai, azure-identity, azure-ai-inference, azure-cosmos, pyjwt, cryptography, python-dotenv.

**Task 1.2 — Entra JWT validation**
Implement `auth/jwt_validator.py`. Fetch the tenant's JWKS from `https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys`. Validate signature, `aud`, `iss`, `tid`. Return a `UserClaims(oid, email, name)` dataclass. Create a FastAPI dependency `get_current_user` used by all protected routes.

**Task 1.3 — Cosmos DB client**
Implement `db/cosmos_client.py` with an async Cosmos DB client singleton. Implement repository classes in `db/repositories/` for each collection. All queries must filter by `user_oid` (partition key). Use `DefaultAzureCredential` for Cosmos auth in production (RBAC), fall back to connection string locally.

**Task 1.4 — Model config loader**
Load `config/models.config.json` at startup. Expose `GET /models/defaults`. This is the org-wide seed list — unauthenticated access allowed.

**Task 1.5 — User model config routes**
Implement `GET/POST/DELETE /me/models` in `routers/models.py`. Validate that `endpoint_url` is a valid HTTPS URL for Foundry models.

**Task 1.6 — Azure credential setup**
`auth/credentials.py` — `DefaultAzureCredential` singleton for Azure OpenAI / Foundry calls.

**Task 1.7 — Azure OpenAI service**
`services/azure_openai.py` — async generator `stream_completion(model_config, system_prompt, user_input)`. Yields `(chunk_text, usage | None)`. Auth via `DefaultAzureCredential` token for `https://cognitiveservices.azure.com/.default`.

**Task 1.8 — Azure AI Foundry service**
`services/azure_foundry.py` — same interface as Task 1.7. Endpoint URL comes from the user's saved `model_config.endpoint_url`.

**Task 1.9 — Race runner + SSE + persistence**
`services/race_runner.py` — `asyncio.gather` over all models. Yield SSE events. On completion, call `race_repo.save(race_doc)` and include `race_id` in the final `done` event payload.

**Task 1.10 — Foundry resource picker endpoint**
`routers/azure_resources.py` — `GET /azure/foundry-resources`. Forwards the user's Bearer token to Azure Resource Manager to list subscriptions and ML workspaces. Returns `{ subscription_id, subscription_name, workspace_name, inference_endpoint }[]`.

**Task 1.11 — Microsoft Graph share resolution**
`services/graph.py` — `resolve_email_to_oid(email, user_token)`. Calls `GET https://graph.microsoft.com/v1.0/users?$filter=mail eq '{email}'`. Validates same tenant. Raises `HTTPException(403)` if not found or different tenant.

**Task 1.12 — Share routes**
`routers/shares.py` — `POST /race/{id}/share` (resolve + write share doc), `GET /me/shared` (query by `recipient_oid`).

**Task 1.13 — History routes**
`routers/history.py` — `GET /me/history` (paginated list), `GET /me/history/{id}` (full doc).

---

### Phase 2 — Frontend Foundation

**Task 2.1 — Vite + MSAL scaffold**
Create Vite React project. Install: `@azure/msal-react @azure/msal-browser three tailwindcss`. Configure MSAL per section 5.1 using env vars `VITE_ENTRA_CLIENT_ID` and `VITE_TENANT_ID`. Wrap `App.jsx` in `<MsalProvider>`. Add `useAuth.js` hook that returns `{ user, getToken, logout }`.

**Task 2.2 — API client wrapper**
`utils/api.js` — `apiFetch(path, options)` that silently acquires a token via MSAL and attaches `Authorization: Bearer` on every request. Handles 401 by redirecting to login.

**Task 2.3 — Model management hooks**
`useModels.js` — fetches `/me/models` and `/models/defaults` on mount, merges into a combined list. `useFoundryResources.js` — fetches `/azure/foundry-resources` lazily when the Add Model modal opens.

**Task 2.4 — Add Model modal**
`AddModelModal.jsx` — two-panel form per section 7.3. Provider toggle (Azure OpenAI / Foundry). For Foundry: `FoundryResourcePicker.jsx` (subscription + workspace dropdowns, auto-fills endpoint URL). Manual URL always editable. Color picker from neon palette. Saves via `POST /me/models`.

**Task 2.5 — System prompt editor + template drawer**
`SystemPromptEditor.jsx` — textarea per slot. `PromptTemplateDrawer.jsx` — lists saved templates from `/me/prompts`. Clicking a template inserts it into the active slot's prompt. Save current prompt as template button.

**Task 2.6 — Input panel + model slot row**
`InputPanel.jsx` + `ModelSlotCard.jsx` — slot row with x / + controls. Enforce min 2 / max 4. "START RACE" button disabled until >= 2 models selected and input is non-empty.

**Task 2.7 — SSE race hook**
`useRace.js` — opens SSE stream on `POST /race`. Parses chunk / ttft / done / error events. Returns `{ modelStates, raceId, status }` where `modelStates` is a map of model_config_id to `{ text, elapsed_ms, ttft_ms, usage, status, finish_position }`.

**Task 2.8 — Result cards + share**
`ResultCard.jsx` — shows after `done`. TokenBadge, timing, response text, "SHARE" button that opens `ShareModal.jsx` (email input, calls `POST /race/{id}/share`).

**Task 2.9 — History and shared pages**
`HistoryPage.jsx` + `HistoryReplay.jsx` — lists past races, click to replay (renders result cards from saved data, no live animation). `SharedPage.jsx` — same but for `/me/shared`.

**Task 2.10 — Settings page**
`SettingsPage.jsx` — three tabs: "My Models" (list + delete saved model configs), "Prompt Templates" (list + delete), "Preferences" (default model selection, saved via `PATCH /me/preferences`).

---

### Phase 3 — Race Animation & Arcade UI

**Task 3.0 — Arcade design system**
Install `"Press Start 2P"` from Google Fonts. Create `arcade.css`: dark background `#0a0a1a`, neon glow utility classes, scanline overlay mixin, neon flicker keyframe, pixel border utility. Apply globally.

**Task 3.1 — Three.js race track**
`RaceTrack.jsx` — orthographic camera, 2–4 dynamic lanes, chequered finish line texture, scanline overlay.

**Task 3.2 — Pixel car meshes**
Per-model `PlaneGeometry` with pixel-art canvas texture colored by model neon. Point light underglow. Sin-wave bobbing while running.

**Task 3.3 — Progress + finish animations**
Wire `useRace.js` into `RaceTrack.jsx`. Progress formula per section 9.2. On `done`: snap to 1.0, confetti burst, "1ST/2ND/3RD/4TH" overlays. All done: grey out non-winners.

**Task 3.4 — HUD labels + timers**
HTML overlays aligned to Three.js lane coordinates. Model name (neon, Press Start 2P), live `ss.ms` timer per lane, freezes on `done`.

**Task 3.5 — Model slot cards arcade styling**
Apply full arcade aesthetic to slot cards: pixel border glow in model neon color, "player select" layout, INSERT COIN idle blink, screen shake on START RACE.

---

## 14. Environment Setup (Developer Quickstart)

### Prerequisites (one-time, done by Azure admin)

1. **Entra ID App Registration**
   - Single-tenant
   - Redirect URIs: `http://localhost:5173` and the production Static Web App URL
   - Expose an API scope: `api://<client-id>/Race.Access`
   - Grant Microsoft Graph `User.Read.All` application permission → admin consent

2. **Developer RBAC assignments** (per developer, on shared dev resources)
   - Cosmos DB account: `Cosmos DB Built-in Data Contributor`
   - Azure AI Foundry workspace(s): `Azure AI Developer`
   - Azure OpenAI resource(s): `Cognitive Services OpenAI User`

3. **Shared dev Cosmos DB account** — one account for the whole dev team is sufficient

### First-time local setup

```bash
# 1. Clone
git clone https://github.com/your-org/llm-racetrack
cd llm-racetrack

# 2. Log in to Azure (one command — covers all Azure calls)
az login
# If your org uses multiple tenants, pin the correct one:
az login --tenant <your-tenant-id>

# 3. Backend
cd backend
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
cd frontend
npm install
cp .env.example .env
# Edit .env — fill in:
#   VITE_ENTRA_CLIENT_ID, VITE_TENANT_ID, VITE_API_BASE_URL=http://localhost:8000

npm run dev
# App is at http://localhost:5173
# Log in with your org account — same SSO as production

# 5. Add a model in the UI
# Click "+" → select Azure AI Foundry → pick your subscription and workspace
# The endpoint URL is auto-filled from ARM
# Enter a model name (e.g. Mistral-large-2411) and save
```

### .env.example (backend)
```
# Non-secret configuration — safe to commit the example file
TENANT_ID=
API_CLIENT_ID=
COSMOS_URL=
FRONTEND_ORIGIN=http://localhost:5173

# Optional: override org-default models config path
MODELS_CONFIG_PATH=config/models.config.json
```

### .env.example (frontend)
```
VITE_ENTRA_CLIENT_ID=
VITE_TENANT_ID=
VITE_API_BASE_URL=http://localhost:8000
```

### Verifying connectivity

```bash
# Check Azure CLI login
az account show

# Check Cosmos DB access
az cosmosdb show --name <account> --resource-group <rg>

# Check Foundry access
az ml workspace show --name <workspace> --resource-group <rg>

# Hit the backend health check (no auth required)
curl http://localhost:8000/health

# Hit a protected endpoint — token comes from browser session
# Use Swagger UI at http://localhost:8000/docs with "Authorize" button
```

---

## 15. Deployment (Azure App Service)

- **Backend**: Azure App Service (Linux, Python 3.11)
  - System-assigned Managed Identity enabled
  - Roles: `Cognitive Services OpenAI User` on each OpenAI resource; `Cosmos DB Built-in Data Contributor` on the Cosmos account
  - App Settings: `TENANT_ID`, `API_CLIENT_ID`, `COSMOS_URL`, `FRONTEND_ORIGIN`
  - Graph API: grant `User.Read.All` application permission to the App Registration (admin consent required once)

- **Frontend**: Azure Static Web Apps
  - Point API proxy to the App Service URL
  - Environment variables: `VITE_ENTRA_CLIENT_ID`, `VITE_TENANT_ID`

- **Cosmos DB**: serverless tier, single region on start
  - RBAC-only access — no connection string keys in any config

---

*End of brief v2.1. All user data is scoped by Entra OID. No secrets stored in code or environment. Extend `models.config.json` for org-wide defaults; users manage their own Foundry endpoints in the UI.*


---

## 16. Repository Strategy & Infrastructure

### 16.1 Fazy

```
Faza 1 — prywatny GitHub (teraz)
  Monorepo z działającą aplikacją + Terraform
  Deploy ręczny z lokalnej maszyny przez az login
  Cel: działające, deployowalne solution w jednym repo

Faza 2 — GitLab (korporacyjny, później)
  Mirror z GitHub lub niezależny fork
  GitLab CI/CD pipeline uruchamia Terraform + deploy apki
  Sekrety w GitLab CI/CD Variables
  Zero zmian w kodzie aplikacji między fazami
```

### 16.2 Struktura monorepo

```
llm-racetrack/
  app/
    backend/          # FastAPI
    frontend/         # React + Vite
  infra/
    main.tf
    variables.tf
    outputs.tf
    terraform.tfvars.example   # tylko placeholdery — commitowany
    terraform.tfvars           # prawdziwe wartości — w .gitignore
  .gitignore
  .pre-commit-config.yaml
  README.md
```

### 16.3 Terraform — zakres (App Service + Cosmos DB)

Terraform tworzy i zarządza:
- Azure Resource Group
- Azure App Service Plan (Linux, Python 3.11)
- Azure App Service (backend FastAPI)
  - System-assigned Managed Identity włączona
  - App Settings wstrzykiwane przez Terraform
- Azure Static Web App (frontend)
- Azure Cosmos DB account (serverless)
  - Baza danych i kontenery z partition keys
- RBAC role assignments:
  - App Service Managed Identity → `Cognitive Services OpenAI User` na każdym OpenAI resource
  - App Service Managed Identity → `Cosmos DB Built-in Data Contributor` na Cosmos account

Terraform **nie tworzy**:
- Entra ID App Registration — ręcznie w Azure Portal (jednorazowo)
- Azure AI Foundry workspace — zakładamy że istnieje
- Azure OpenAI deployments — zakładamy że istnieją

### 16.4 Pliki Terraform

`infra/variables.tf`:
```hcl
variable "tenant_id"            { type = string }
variable "subscription_id"      { type = string }
variable "resource_group_name"  { type = string }
variable "location"             { type = string  default = "West Europe" }
variable "app_name"             { type = string  default = "llm-racetrack" }
variable "entra_client_id"      { type = string  description = "App Registration client ID — created manually" }
variable "cosmos_db_name"       { type = string  default = "llm-racetrack-db" }
variable "openai_resource_ids"  { type = list(string)  description = "Resource IDs of Azure OpenAI accounts to grant access to" }
variable "frontend_origin"      { type = string  description = "Static Web App URL — set after first deploy" }
```

`infra/terraform.tfvars.example` (commitowany, bez wartości):
```hcl
tenant_id            = ""
subscription_id      = ""
resource_group_name  = ""
location             = "West Europe"
entra_client_id      = ""
openai_resource_ids  = []
frontend_origin      = ""
```

`infra/terraform.tfvars` — w `.gitignore`, nigdy nie commitowany.

`infra/outputs.tf` — po `terraform apply` wypisuje:
```hcl
output "app_service_url"     { value = azurerm_linux_web_app.backend.default_hostname }
output "static_web_app_url"  { value = azurerm_static_web_app.frontend.default_host_name }
output "cosmos_url"          { value = azurerm_cosmosdb_account.main.endpoint }
output "managed_identity_id" { value = azurerm_linux_web_app.backend.identity[0].principal_id }
```

### 16.5 Deploy ręczny (Faza 1 — z lokalnej maszyny)

Wymagania wstępne:
- `az login` z kontem które ma `Owner` lub `Contributor` + `User Access Administrator` na subskrypcji
- Terraform CLI zainstalowany
- App Registration w Entra ID założona ręcznie (jednorazowo — patrz sekcja 14)

```bash
# 1. Infrastruktura
cd infra
cp terraform.tfvars.example terraform.tfvars
# Wypełnij terraform.tfvars prawdziwymi wartościami

terraform init
terraform plan
terraform apply
# Zapisz outputy — cosmos_url i app_service_url potrzebne w kolejnym kroku

# 2. Frontend build
cd ../app/frontend
npm ci && npm run build

# 3. Deploy backend
cd ../backend
zip -r deploy.zip . -x "*.pyc" -x "__pycache__/*" -x ".venv/*"
az webapp deploy   --resource-group <rg>   --name <app-service-name>   --src-path deploy.zip   --type zip

# 4. Deploy frontend
az staticwebapp deploy   --name <static-web-app-name>   --resource-group <rg>   --source ../frontend/dist/   --token $(az staticwebapp secrets list --name <name> --query "properties.apiKey" -o tsv)
```

### 16.6 Branch strategy (prywatny GitHub)

```
main        — chroniony, deployowalny, tylko przez PR
develop     — bieżąca integracja
feature/*   — feature/foundry-picker, feature/race-animation itd.
fix/*       — hotfixy z main
```

Branch protection na `main`:
- Wymagaj PR przed merge
- No direct push (nawet od właściciela)

### 16.7 .gitignore — krytyczne wpisy

```gitignore
# Terraform — sekrety
infra/terraform.tfvars
infra/.terraform/
infra/*.tfstate
infra/*.tfstate.backup
infra/.terraform.lock.hcl   # opcjonalnie — lepiej commitować dla reproducibility

# Aplikacja
app/backend/.env
app/frontend/.env
app/backend/config/models.config.json   # jeśli zawiera org-specyficzne dane

# Python
__pycache__/
*.pyc
.venv/

# Node
node_modules/
app/frontend/dist/
```

### 16.8 Pre-commit (ochrona przed wyciekiem sekretów)

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: detect-private-key
      - id: check-added-large-files

  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```

```bash
pip install pre-commit --break-system-packages
pre-commit install   # aktywuje hooki lokalnie
```

### 16.9 Faza 2 — GitLab CI/CD + Terraform (później)

Gdy repo trafi na GitLab korporacyjny, pipeline zastępuje ręczne kroki z 16.5:

```yaml
# .gitlab-ci.yml (szkielet — do rozbudowania w Fazie 2)
stages:
  - validate
  - infra
  - deploy

terraform-plan:
  stage: infra
  image: hashicorp/terraform:latest
  script:
    - cd infra
    - terraform init -backend-config="..." 
    - terraform plan -var-file=$TF_VARS_FILE
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

terraform-apply:
  stage: infra
  script:
    - cd infra && terraform apply -auto-approve -var-file=$TF_VARS_FILE
  when: manual   # wymaga ręcznego zatwierdzenia w GitLab UI
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

deploy-app:
  stage: deploy
  script:
    - cd app/backend && zip deploy.zip ...
    - az webapp deploy ...
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

Wszystkie wartości z `terraform.tfvars` wędrują do **GitLab CI/CD Variables** (Protected + Masked) jako `TF_VARS_FILE` (File Variable) — nigdy w kodzie.

Terraform state w Fazie 2 przechowywany w **Azure Blob Storage** (remote backend) zamiast lokalnie.

---

*Brief v2.2 — monorepo /app + /infra, ręczny deploy Faza 1, GitLab CI/CD + Terraform Faza 2.*
