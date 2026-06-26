from fastapi import FastAPI, HTTPException
from app.adapters.providers import GeminiAdapter

app = FastAPI(title="A.X.I.S. Backend")

# Dependency injection for the provider
# In a real scenario, use a factory function to choose based on environment settings
adapter = GeminiAdapter()

@app.get("/api/health")
async def health_check():
    """
    Basic health check to verify backend is up.
    """
    return {"status": "ok", "service": "A.X.I.S. Backend v1.0.0"}

@app.post("/api/forms/{form_id}/process")
async def process_form(form_id: str):
    """
    Endpoint to trigger document processing.
    """
    try:
        # Placeholder for fetching file bytes by form_id
        dummy_data = b"some_file_bytes"
        result = await adapter.process_document(dummy_data)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))