# Revenue Cycle Frontend

This is the React frontend for the Revenue Cycle Optimization project.

It uses a minimal TypeScript setup.

---

## Prerequisites

- Node.js (version 20 or higher recommended)
- npm (comes with Node.js)

---

## Setup

1. Clone the repository:

2. Install dependencies:

npm install

3. run the app:

npm start

---

## Local mock mode

The app can run against in-memory mock data instead of the backend. Mocking is **off by default**; the UI calls the real API (`src/services/api.ts`). When mock mode is enabled, requests go through `src/services/mock_api.ts` (selected in `src/services/index.ts`).

Create `frontend/.env.local` (or set the variable in your shell) with:

```
REACT_APP_USE_MOCK_API=true
```

Restart the dev server after changing env vars. Omit this variable or set it to anything other than `true` to use the real backend.