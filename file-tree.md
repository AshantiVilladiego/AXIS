# A.X.I.S. File Tree

This tree covers the code and code-support files that are actively involved in the project. It excludes docs, generated artifacts, and cache files.

```text
AXIS/
├── init_schema.sql  # Database schema definition that describes the data shape the extraction pipeline is expected to populate.
├── .env.example  # Root environment template for shared project settings.
├── backend/
│   ├── requirements.txt  # Python dependency list for the FastAPI backend.
│   ├── .env.example  # Backend environment template for credentials and service settings.
│   └── app/
│       ├── main.py  # Current FastAPI entrypoint; defines the app, CORS setup, health check, upload endpoint, and legacy form processing endpoint.
│       ├── adapters/
│       │   ├── base.py  # Abstract interface that all AI/model adapters must implement.
│       │   └── providers.py  # Provider implementations for document processing, including GeminiAdapter and GroqAdapter.
│       ├── api/
│       │   └── v1/
│       │       ├── api.py  # Planned API router aggregation module for v1 endpoints; currently empty.
│       │       └── endpoints/
│       │           ├── health.py  # Planned health endpoint module for the v1 router; currently empty.
│       │           └── forms.py  # Planned form/upload endpoint module for the v1 router; currently empty.
│       ├── core/
│       │   └── config.py  # Planned centralized settings module for environment-driven backend configuration; currently empty.
│       ├── db/
│       │   └── session.py  # Planned async database session and dependency setup; currently empty.
│       └── services/
│           ├── document_service.py  # Planned orchestration layer for upload processing, AI calls, and persistence; currently empty.
│           └── model_router.py  # Planned model failover and provider routing layer; currently empty.
└── frontend/
	├── package.json  # Frontend package manifest, scripts, and dependency list.
	├── package-lock.json  # Locked dependency versions for repeatable frontend installs.
	├── next-env.d.ts  # Next.js TypeScript environment types.
	├── postcss.config.js  # PostCSS configuration used by the Tailwind build pipeline.
	├── tailwind.config.ts  # Tailwind theme and utility configuration.
	├── tsconfig.json  # TypeScript compiler configuration for the Next.js app.
	├── app/
	│   ├── layout.tsx  # Root layout that wraps the app with global styles and the Supabase provider.
	│   ├── page.tsx  # Main dashboard page that switches between the sidebar sections and checks backend health.
	│   └── globals.css  # Global stylesheet and base Tailwind layer setup.
	└── components/
		├── UploadForm.tsx  # Upload UI that sends documents to the backend and currently shows a placeholder extraction view.
		├── ProcessingHistory.tsx  # Processing history dashboard component with mock rows for now.
		├── ProfileRepository.tsx  # Profile data form UI for storing personal and government ID details.
		├── Settings.tsx  # Settings panel for local UI preferences and AI toggles.
		├── Sidebar.tsx  # Left navigation component that controls the active dashboard section.
		└── providers/
			└── SupabaseProvider.tsx  # Supabase client provider and React context for frontend auth/data access.
```
