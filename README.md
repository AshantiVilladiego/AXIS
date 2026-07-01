# A.X.I.S.

### Automated eXtraction & Integration System

A.X.I.S. is an AI-powered document automation platform that helps users complete government forms by automatically extracting, mapping, and generating pre-filled forms from stored profile data.

---

## Features

* User Authentication
* Secure Profile Management
* Government Form Upload
* OCR & Document Parsing
* AI-Powered Field Mapping
* Pre-filled PDF Generation
* Guided Form Completion
* Processing History Dashboard
* Multi-Provider AI Failover

---

## Tech Stack

### Frontend

* Next.js
* Tailwind CSS

### Backend

* FastAPI
* Python

### Database

* PostgreSQL
* Supabase

### AI Services

* Google Gemini
* Groq
* Hugging Face

### Storage

* Supabase Storage

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

Our DB engineer has already initialized the schema in Supabase. You do not need to run any local scripts; simply ensure your local `.env` files (both backend and frontend) are updated with the connection details from our existing Supabase project.

### 4. Verification

To ensure both services are running correctly:

**Backend:** Start the server with `uvicorn app.main:app --reload` (from inside the `backend/` folder).

* Verify connectivity: Visit `[http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)`. You should receive a successful JSON response.
* View API documentation: Visit `[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)`

**Frontend:** Start the server with `npm run dev` (from inside the `frontend/` folder). You should see the application running on `http://localhost:3000`.

---

## Environment Variables

This project uses separate environment configurations for security:

* **Backend (.env):** Contains database credentials and private AI API keys (Gemini/Groq/HF).
* **Frontend (.env):** Contains public Supabase keys and API connection strings.

*Refer to the `.env.example` files located in the `backend/` and `frontend/` directories for required keys.*

---

## API Documentation

See docs/API_SPECIFICATION.md

---

## License

MIT License