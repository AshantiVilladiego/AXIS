from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.adapters.providers import GeminiAdapter

# Initialize the application
app = FastAPI(title="A.X.I.S. Backend Engine")

# Initialize the AI Provider (Ashanti's Code)
adapter = GeminiAdapter()

# Configure CORS (Michael's Code - required for React frontend)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    """
    Combined health check to verify backend is up.
    """
    return {
        "status": "online",
        "message": "A.X.I.S. API Engine is operational",
        "database": "connected",
        "service": "A.X.I.S. Backend v1.0.0"
    }

# --- INTEGRATED UPLOAD ENDPOINT ---

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    form_type: str = Form(...) 
):
    """
    Receives a document from the Next.js frontend and processes it using the AI adapter.
    """
    try:
        # Read the file sent by the frontend
        content = await file.read()
        file_size = len(content)
        
        # Pass the binary file content directly to Ashanti's AI adapter
        ai_result = await adapter.process_document(content)
        
        return {
            "filename": file.filename,
            "content_type": file.content_type,
            "size_in_bytes": file_size,
            "form_type": form_type,
            "message": "File processed successfully by AI Engine.",
            "extracted_data": ai_result # Sends the AI extraction back to React!
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# --- ORIGINAL TEST ENDPOINT (Preserved for testing) ---

@app.post("/api/forms/{form_id}/process")
async def process_form(form_id: str):
    """
    Ashanti's original endpoint to trigger document processing via DB ID.
    """
    try:
        # Placeholder for fetching file bytes by form_id
        dummy_data = b"some_file_bytes"
        result = await adapter.process_document(dummy_data)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))