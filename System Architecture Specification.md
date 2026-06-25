# System Architecture Specification

A.X.I.S. (Automated eXtraction & Integration System)

---

# 1. Architecture Overview

The system follows a three-tier architecture:

- Presentation Layer
- Business Logic Layer
- Data Layer

---

# 2. High-Level Components

Frontend (Next.js)

Responsibilities:

* Authentication
* Dashboard
* File Upload Interface
* Results Visualization

Backend (FastAPI)

Responsibilities:

* API Endpoints
* Document Processing
* AI Routing
* PDF Generation

Database (PostgreSQL)

Responsibilities:

* User Profiles
* Processing Logs
* Generated Documents

Storage (Supabase Storage)

Responsibilities:

* Uploaded Forms
* Generated PDFs

AI Providers

- Google Gemini
- Groq
- Hugging Face

Responsibilities:

* OCR
* Layout Analysis
* Form Interpretation
* Field Mapping

---

# 3. Data Flow

Step 1:
User uploads PDF/Image

↓

Step 2:
Frontend sends file to FastAPI

↓

Step 3:
Backend stores file in Supabase Storage

↓

Step 4:
Backend triggers OCR pipeline

↓

Step 5:
Document AI extracts fields

↓

Step 6:
User profile data retrieved

↓

Step 7:
Field mapping engine executes

↓

Step 8:
PDF generator fills coordinates

↓

Step 9:
Generated PDF stored

↓

Step 10:
Download URL returned

---

# 4. Security Architecture

Authentication:
Supabase Auth

Authorization:
Row-Level Security (RLS)

Encryption:
AES-256 encryption at rest

Secrets:
Environment Variables

Repository:
Private GitHub Repository

---

# 5. AI Provider Routing

Primary:
Gemini

Fallback:
Groq

Secondary Fallback:
Hugging Face

Failure Handling:
429 Rate Limit → Queue → Retry

Retry Delay:
5 seconds

Maximum Retries:
3

---

# 6. API Specification

| Method | Endpoint                | Description           |
| ------ | ----------------------- | --------------------- |
| POST   | /api/auth/register      | Register user         |
| POST   | /api/auth/login         | User login            |
| GET    | /api/profile            | Retrieve profile      |
| PUT    | /api/profile            | Update profile        |
| POST   | /api/forms/upload       | Upload form           |
| GET    | /api/forms              | Get uploaded forms    |
| GET    | /api/forms/{id}         | Retrieve form details |
| POST   | /api/forms/{id}/process | Process uploaded form |
| GET    | /api/forms/{id}/result  | Get generated output  |
| GET    | /api/history            | Processing history    |
| DELETE | /api/forms/{id}         | Delete form           |
| GET    | /api/health             | System health check   |
