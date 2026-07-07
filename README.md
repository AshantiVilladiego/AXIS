# A.X.I.S.

### Automated eXtraction & Integration System

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

### 0. Fetch the Changes

```bash
# Pull the latest work from the branch
git pull origin [branch name]

```

### 1. Backend Setup

```bash
# Move into the backend directory
cd backend

# Create & Activate Virtual Environment
python -m venv venv
source venv/Scripts/activate  # (Use .\venv\Scripts\activate on Windows)

# Install & Configure
pip install -r requirements.txt
cp .env.example .env
# [Action: Fill in your local API keys in .env]

```

### 2. Frontend Setup

```bash
# Move to root, then frontend
cd ..
cd frontend

# Install & Configure
npm install
cp .env.example .env
# [Action: Fill in your Supabase keys in .env]

```

### 3. Database Setup

Our DB engineer has already initialized the schema in Supabase. Use the shared cloud PostgreSQL connection string from the existing Supabase project in `backend/.env`, so everyone on the team points to the same hosted database during development.

The backend is configured to use SSL automatically for hosted database hosts such as Supabase, so no local PostgreSQL installation is required.

### 4. Verification

To ensure both services are running correctly:

**Backend:** Start the server with `uvicorn app.main:app --reload` (from inside the `backend/` folder).

- Verify connectivity: Visit `[http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)`. You should receive a successful JSON response.
- Verify database access: Visit `[http://127.0.0.1:8000/api/db-check](http://127.0.0.1:8000/api/db-check)`. You should receive `database: connected` when the cloud database is reachable.
- View API documentation: Visit `[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)`

**Frontend:** Start the server with `npm run dev` (from inside the `frontend/` folder). You should see the application running on `http://localhost:3000`.

---

## Environment Variables

This project uses separate environment configurations for security:

- **Root `.env.example`:** Reference only. It shows the full split of backend and frontend variables in one place.
- **Backend `backend/.env`:** Private server-side settings such as `DATABASE_URL`, Supabase service keys, and AI API keys.
- **Frontend `frontend/.env`:** Public browser-safe settings such as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_URL`.

Use the matching `.env.example` file in each folder as the template for the actual `.env` file.

---

## API Documentation

See docs/API_SPECIFICATION.md

---

## License

MIT License
