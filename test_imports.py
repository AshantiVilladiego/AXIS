try:
    from app.services import chatbot_service
    print("Import successful!")
except ImportError as e:
    print(f"Import failed: {e}")