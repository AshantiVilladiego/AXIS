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

## Installation

### Frontend

npm install

npm run dev

### Backend

pip install -r requirements.txt

uvicorn app.main:app --reload

---

## Environment Variables

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

DATABASE_URL=

GEMINI_API_KEY=
GROQ_API_KEY=
HF_API_KEY=

REDIS_URL=

---

## API Documentation

See docs/API_SPECIFICATION.md

---

## License

MIT License
