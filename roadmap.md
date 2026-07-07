# A.X.I.S. Roadmap

## Team Roles

| Role                                    | Name       |
| :-------------------------------------- | :--------- |
| Project Manager                         | Mica       |
| System Analyst                          | Ashanti    |
| Quality Assurance                       | Ashanti    |
| Frontend Lead                           | Johan      |
| DB/Cloud Engineer & Frontend Dev Helper | Mary Ann   |
| Backend Lead                            | Mica       |
| AI/ML Engineer & Backend Dev Helper     | Ann Denise |

## Current Status Snapshot

As of 2026-07-02, the codebase is still in a partially wired state. The backend exposes a working FastAPI app with `/api/health`, `/api/upload`, and `/api/forms/{form_id}/process`, but the upload flow still calls `GeminiAdapter` directly from `main.py`. The planned route modularization, database session layer, orchestration service, and model failover router are not implemented yet.

The frontend is also mostly UI-first. `UploadForm` can submit a file to the backend, but success handling is still an alert and the extracted-fields section is placeholder UI. `ProcessingHistory` uses mock data, `ProfileRepository` is static, and `Settings` only manages local state.

## Phase 3: Sprint 2 (June 29–July 3) — AI Logic & OCR

Goal: Close the loop between the UploadForm component and the GeminiAdapter.

## Work Assignment Table

| Task                     | Assigned To | Actionable Steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Due Date     | Jira Label |
| :----------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- | :--------- |
| API Modularization       | Mica        | Refactor the current FastAPI entrypoint so `GET /api/health` and `POST /api/upload` live in `backend/app/api/v1/endpoints/` instead of `main.py`, then expose them through `backend/app/api/v1/api.py`. This should preserve the current runtime behavior, keep the routes accessible at the same URLs, and establish the v1 router pattern the codebase will use for future endpoints. Confirm the app still starts cleanly after the move and that both routes respond exactly as they do now. | July 3, 2026 | backend    |
| Core Config Setup        | Mica        | Create a proper settings layer in `backend/app/core/config.py` using Pydantic so the backend reads `DATABASE_URL` and provider credentials from environment variables instead of hardcoded values. The configuration should be importable by the rest of the backend, should fail clearly when required values are missing, and should prepare the project for async database and provider integration without changing the current API behavior.                                                | July 3, 2026 | backend    |
| DB Session Setup         | Mica        | Implement async database plumbing in `backend/app/db/session.py`, including the async engine, `AsyncSessionLocal`, and a reusable `get_db` dependency that can be injected into FastAPI routes later. The implementation should use `DATABASE_URL`, be compatible with FastAPI dependency injection, and be written so future repository or service layers can perform reads and writes without reworking the session setup again.                                                               | July 3, 2026 | backend    |
| OCR and Extraction Logic | Ann Denise  | Update `backend/app/adapters/providers.py` so `GeminiAdapter` returns a clean structured dictionary that maps directly to the keys expected by `init_schema.sql`, instead of returning loosely formatted or UI-facing output. The adapter should normalize the AI response, strip markdown or extra text, detect malformed responses, and raise a clear exception or error response path when extraction fails so the upload endpoint can handle it safely.                                      | July 3, 2026 | ai-ml      |
| Document Orchestration   | Mica        | If the sprint has capacity, introduce `backend/app/services/document_service.py` as the orchestration layer for the upload workflow, with the service responsible for receiving the file payload, calling the AI adapter, and returning a structured result. If the service cannot be completed in this sprint, keep the upload flow in `main.py` but make sure the code path is organized so this service can be extracted later without changing the public API contract.                      | July 3, 2026 | backend    |
| Upload Response Shape    | Johan       | Keep `POST /api/upload` returning a stable and frontend-friendly JSON payload that always includes `filename`, `form_type`, `status`, and `extracted_data`, so the React UI can reliably render the extraction result without guessing at the response structure. The response contract should stay consistent across success and failure cases, and any future changes should preserve the same top-level keys.                                                                                 | July 3, 2026 | frontend   |
| QA Validation            | Ashanti     | Validate the upload pipeline with at least one successful sample file and one failure scenario, then confirm the returned JSON structure, extracted field names, and error behavior match `init_schema.sql` and the current API contract. The test should catch malformed extraction output, verify that the app does not crash on bad input, and document any mismatch between the AI output and the schema.                                                                                    | July 3, 2026 | qa-testing |

## Phase 4: Sprint 3 (July 4–6) — QA & Deployment

Goal: Final Polish, Testing, and System Launch.

## Work Assignment Table

| Task                       | Assigned To | Actionable Steps                                                                                                                                                                                                                                                                                                                                                                                                                         | Due Date     | Jira Label |
| :------------------------- | :---------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- | :--------- |
| Upload Response Binding    | Johan       | In `frontend/components/UploadForm.tsx`, replace the current success `alert()` behavior with component state that stores the upload response and renders the `extracted_data` fields directly in the “Extracted Fields” section. The implementation should show meaningful values only after a successful upload, keep the current upload UX intact, and ensure the UI reflects the backend response instead of static placeholder text. | July 4, 2026 | frontend   |
| Processing History Binding | Johan       | Keep `frontend/components/ProcessingHistory.tsx` as mock UI unless a real backend history endpoint is introduced; if that endpoint exists, wire the table to fetch and render real records without breaking the current layout. The task should clarify the data source, keep the current design stable, and avoid inventing backend behavior that does not exist yet.                                                                   | July 5, 2026 | frontend   |
| Profile Sync               | Mary Ann    | Add local state handling and a save flow stub for `frontend/components/ProfileRepository.tsx` so the form can later be connected to a backend profile persistence endpoint. The work should define the field mapping, preserve the current form layout, and stop short of claiming database writes until the backend API exists and is agreed.                                                                                           | July 5, 2026 | frontend   |
| Auth Screens               | Johan       | Treat login and register screens as stretch work for now and only begin them after the upload flow is stable enough to avoid distracting from the core release path. If started, the screens should follow the existing Supabase setup and focus on basic sign-in/sign-up flows rather than full auth polish or edge-case handling.                                                                                                      | July 6, 2026 | frontend   |
| Model Failover Router      | Ann Denise  | Implement `ModelRouter` only after the Sprint 2 backend foundation is complete, so the routing logic can sit on top of a stable upload and adapter layer instead of competing with core plumbing work. The router should eventually support provider fallback, but this sprint should not force it if the backend session and upload flow are still being finalized.                                                                     | July 6, 2026 | ai-ml      |
| API Stability              | Mica        | Run repeated upload tests against `/api/upload`, confirm the endpoint returns the expected 200 success path and a controlled 500 failure path, and fix any crashes, hangs, or unhandled exceptions uncovered during those checks. The goal is to make the current upload route dependable before additional backend layers are added.                                                                                                    | July 6, 2026 | backend    |
| End-to-end QA              | Ashanti     | Validate one complete upload flow from the frontend through the backend using a sample PDF or image, then confirm the request reaches the API, the response format is usable by the UI, and bad input is handled safely. The result should document the observed behavior and flag any gaps between the current implementation and the planned workflow.                                                                                 | July 6, 2026 | qa-testing |

## Implemented Today

| Area                  | Status  | Notes                                                                                                                            |
| :-------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------- |
| FastAPI app           | Done    | `backend/app/main.py` defines the app, CORS, `/api/health`, `/api/upload`, and a legacy `/api/forms/{form_id}/process` endpoint. |
| AI adapter call       | Partial | `GeminiAdapter` is called directly from the upload route. There is no retry router or shared orchestration layer yet.            |
| Frontend upload UI    | Partial | `frontend/components/UploadForm.tsx` posts to `/api/upload`, but it does not bind returned extracted data into state.            |
| Processing history UI | Mocked  | `frontend/components/ProcessingHistory.tsx` renders static sample rows.                                                          |
| Profile repository UI | Mocked  | `frontend/components/ProfileRepository.tsx` is a static form with no save flow.                                                  |
| Settings UI           | Partial | `frontend/components/Settings.tsx` is local UI state only.                                                                       |
| Supabase client setup | Done    | `frontend/components/providers/SupabaseProvider.tsx` initializes a client, but auth screens are not present yet.                 |

## Not Yet Implemented

| Area                   | Priority | What is missing                                                                                          |
| :--------------------- | :------- | :------------------------------------------------------------------------------------------------------- |
| API modularization     | High     | Move route logic out of `main.py` into `backend/app/api/v1/endpoints/` and wire `APIRouter`.             |
| Core config            | High     | Add Pydantic settings in `backend/app/core/config.py` for loading env values such as `DATABASE_URL`.     |
| DB session layer       | High     | Implement async engine setup, `SessionLocal`, and `get_db` in `backend/app/db/session.py`.               |
| Document orchestration | High     | Implement `DocumentService` to coordinate DB writes and AI processing.                                   |
| Model failover         | High     | Implement `ModelRouter` in `backend/app/services/model_router.py` for Gemini/Groq/Hugging Face fallback. |
| Persistence            | High     | Save uploaded file metadata and extracted fields to the database.                                        |
| Frontend data binding  | Medium   | Replace mock history and placeholder extraction UI with live API data.                                   |
| Profile sync           | Low      | Connect the profile form to a backend save endpoint once a real profile API exists.                      |
| Auth screens           | Low      | Build login and register screens using Supabase Auth after the core document flow is stable.             |

## Deferred Or Stretch

These items are useful, but they should not block the core release plan:

| Item                       | Reason                                                                                 |
| :------------------------- | :------------------------------------------------------------------------------------- |
| Processing history API     | There is no confirmed backend endpoint yet, so this should follow the upload pipeline. |
| Full profile save flow     | The current backend does not expose a profile persistence route.                       |
| Supabase auth screens      | Nice to have, but not required to validate the document extraction flow.               |
| Full model failover router | Important, but it should follow a stable upload path and DB session layer.             |

## Sprint 2 Remaining Work

### Backend

1. Move upload and health routes into `backend/app/api/v1/endpoints/`.
2. Implement async database configuration and dependency injection.
3. Add `DocumentService` so upload processing follows save -> AI -> persist.
4. Add `ModelRouter` failover logic and make adapter errors return clean API responses.
5. Validate extracted data against `init_schema.sql` before saving.

### Frontend

1. Update `UploadForm` to read `extracted_data` from the upload response and render it dynamically.
2. Keep `ProcessingHistory` and `ProfileRepository` as static UI until the backend endpoints exist.

### QA

1. Verify the extracted payload matches the schema in `init_schema.sql`.
2. Confirm the UI shows success and error states based on the real API response.
3. Test upload failure handling so malformed OCR or provider errors do not crash the app.

## Sprint 3 Target

### Phase 4: QA and Deployment

| Task               | Assigned To | Goal                                                                         |
| :----------------- | :---------- | :--------------------------------------------------------------------------- |
| End-to-end testing | Ashanti     | Validate UploadForm -> backend -> extraction response -> error handling.     |
| API stability      | Mica        | Stress test `/api/upload` and verify the simplified service layer is stable. |
| Model tuning       | Ann Denise  | Refine prompts and extraction accuracy once the router is in place.          |
| UI polish          | Johan       | Add loading and processing states for the upload flow only.                  |
| Deployment and ops | Mary Ann    | Finalize environment handling and deployment configuration.                  |

## Notes

- The roadmap below assumes the next milestone is to finish the backend service layer first, then connect the frontend to those real responses.
- Any task that claims the app already has route modularization, async DB wiring, persistence, or live history/profile data should be treated as pending, not complete.
