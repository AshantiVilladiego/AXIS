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

### 1. Prerequisites
* **Python 3.10+**
* **Node.js 18+**
* **PostgreSQL**

### 2. Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it:
   * Windows: `source venv/Scripts/activate`
   * Linux/Mac: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. **Configuration:** Copy the `backend/.env.example` to `backend/.env` and populate your API keys and database URL.

### 3. Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. **Configuration:** Copy the `frontend/.env.example` to `frontend/.env` and populate your Supabase keys.
4. Run the development server: `npm run dev`

### 4. Database Setup
1. Ensure PostgreSQL is running.
2. Execute the `init_schema.sql` script in your local database to create the necessary tables and policies.

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