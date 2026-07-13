# A.X.I.S.
### Automated eXtraction & Integration System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-stable-brightgreen.svg)
![Development](https://img.shields.io/badge/development-ongoing-yellow.svg)
![Backend](https://img.shields.io/badge/backend-FastAPI-blue?logo=fastapi)
![Frontend](https://img.shields.io/badge/frontend-Next.js-black?logo=next.js)

A.X.I.S. is an AI-powered document automation platform that helps users complete government forms by automatically extracting, mapping, and generating pre-filled forms from stored profile data.

---

## Features

- User Authentication
- Secure Profile Management
- Government Form Upload
- OCR & Document Parsing
- AI-Powered Field Mapping
- Pre-filled PDF Generation
- Guided Form Completion
- Processing History Dashboard
- Multi-Provider AI Failover

---

## Tech Stack

### Frontend
- Next.js
- Tailwind CSS

### Backend
- FastAPI
- Python

### Database
- PostgreSQL
- Supabase

### AI Services
- Google Gemini
- Groq
- Hugging Face

### Storage
- Supabase Storage

---

## System Workflow

1. User uploads a government form.
2. OCR extracts form fields.
3. Document AI identifies form type.
4. User profile data is matched to form fields.
5. AI validates extracted data.
6. System generates a pre-filled PDF.
7. User downloads the completed document.

---

## 🛠️ Developer Setup Guide

To get the A.X.I.S. platform running locally, follow these steps:

### 1. Backend Setup

```bash
# Create & Activate Virtual Environment
python -m venv venv
# Windows:
source venv/Scripts/activate 
# macOS/Linux:
source venv/bin/activate

# Install Dependencies
pip install -r requirements.txt

# Configure Environment
cp .env.example .env
# [Action: Fill in your API keys in the root .env file]
```

### 2. Frontend Setup

```bash
# Move to frontend directory
cd frontend

# Install Dependencies
npm install

# Configure Environment
cp .env.example .env
# [Action: Fill in your Supabase keys in frontend/.env]
```

### 3. Database Setup

Our DB engineer has already initialized the schema in Supabase. Use the shared cloud PostgreSQL connection string from your Supabase project in the root `.env` file.

The backend is configured to use SSL automatically for hosted databases like Supabase, so no local PostgreSQL installation is required.

### 4. Verification

**Backend:** Start the server from the root directory:

```bash
uvicorn app.main:app --reload
```

* **Verify connectivity:** Visit `http://127.0.0.1:8000/api/health`.
* **Verify DB access:** Visit `http://127.0.0.1:8000/api/db-check`.
* **View API docs:** Visit `http://127.0.0.1:8000/docs`.

**Frontend:** Start the server from the `frontend/` directory:

```bash
npm run dev
```

* Access the application at `http://localhost:3000`.

---

## Environment Variables

* **Root `.env`:** Contains backend secrets, database connection strings, and API keys.
* **Frontend `.env`:** Contains public browser-safe variables (`NEXT_PUBLIC_...`).

---

## API Documentation

See `System Architecture Specification.md` for endpoint details.

---

## Project Structure

> **Note:** A.X.I.S. is under active development — this structure is a work in progress and will continue to evolve as new features and modules are added.

```text
AXIS/
├── api/
│   └── index.py
├── app/
│   ├── adapters/
│   │   ├── base.py
│   │   ├── chat_adapters.py
│   │   ├── dummy.py
│   │   ├── model_router.py
│   │   ├── prompts.py
│   │   └── providers.py
│   ├── api/v1/endpoints/
│   │   └── api.py
│   ├── chatbot.py
│   ├── core/
│   │   ├── auth.py
│   │   └── config.py
│   ├── db/
│   │   └── session.py
│   ├── main.py
│   ├── schema.py
│   ├── services/
│   │   ├── chatbot_service.py
│   │   ├── document_service.py
│   │   ├── fixed_prompts.py
│   │   └── pdf_generator.py
│   ├── test_runner.py
│   └── utils/
│       └── label_humanizer.py
├── certs/
│   └── prod-ca-2021.crt
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── AuthForm.tsx
│   │   ├── chatbot/
│   │   ├── ProcessingHistory.tsx
│   │   ├── ProfileRepository.tsx
│   │   ├── providers/
│   │   ├── Settings.tsx
│   │   ├── Sidebar.tsx
│   │   └── UploadForm.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── i18n.ts
│   │   └── types.ts
│   └── package.json
├── init_schema.sql
├── README.md
├── requirements.txt
└── System Architecture Specification.md
```

**Directory overview:**

| Path | Description |
|---|---|
| `api/index.py` | Deployment/serverless entry point (e.g. Vercel handler) that wraps the FastAPI app. |
| `app/adapters/` | AI provider integrations — `base.py` defines the adapter interface, `providers.py` and `model_router.py` handle multi-provider failover/routing, `chat_adapters.py` and `dummy.py` provide chat-specific and mock adapters, `prompts.py` holds adapter-level prompt templates. |
| `app/api/v1/endpoints/api.py` | Versioned FastAPI route definitions for the REST API. |
| `app/chatbot.py` | Core chatbot orchestration logic tying adapters and services together. |
| `app/core/` | Cross-cutting app configuration — `auth.py` for authentication/authorization, `config.py` for environment and settings management. |
| `app/db/session.py` | Database session/connection management (SQLAlchemy or similar). |
| `app/main.py` | FastAPI application entry point and app factory. |
| `app/schema.py` | Pydantic models / request-response schemas. |
| `app/services/` | Business logic layer — chatbot orchestration (`chatbot_service.py`), document extraction/mapping (`document_service.py`), static prompt sets (`fixed_prompts.py`), and PDF generation (`pdf_generator.py`). |
| `app/test_runner.py` | Script/utility for running backend tests. |
| `app/utils/label_humanizer.py` | Helper for converting raw field labels into human-readable form. |
| `certs/prod-ca-2021.crt` | CA certificate used for SSL verification against the production database host. |
| `frontend/app/` | Next.js App Router pages — `dashboard/page.tsx` is the main dashboard, `layout.tsx`/`page.tsx` define the root layout and landing page, `globals.css` holds global styles. |
| `frontend/components/` | Reusable UI components — auth form, chatbot UI, processing history view, profile repository, provider context components, settings panel, sidebar navigation, and the document upload form. |
| `frontend/lib/` | Frontend utilities — `api.ts` for backend API calls, `i18n.ts` for localization, `types.ts` for shared TypeScript types. |
| `frontend/package.json` | Frontend dependencies and scripts. |
| `init_schema.sql` | SQL script to initialize the database schema (tables, constraints, etc.). |
| `README.md` | Project overview and setup instructions (this file). |
| `requirements.txt` | Python backend dependencies. |
| `System Architecture Specification.md` | Detailed architecture and API documentation. |

---

## License

MIT License