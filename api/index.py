# api/index.py
from app.main import app  # Import the FastAPI 'app' object from your existing structure

# Vercel needs to see an 'app' instance exported here
# The 'app' object in your existing main.py is already correctly configured