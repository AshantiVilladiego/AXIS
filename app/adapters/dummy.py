from typing import Dict, Any
from app.adapters.base import ModelAdapter

class DummyAdapter(ModelAdapter):
    """
    A fast, local-only adapter for testing the pipeline 
    without triggering real AI API calls.
    """
    
    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        # This simulates a successful AI extraction
        return {
            "provider": "dummy",
            "status": "success",
            "data": {
                "full_name": "Micaella Reganit Salili",
                "tin": "123-456-789",
                "address": "Polytechnic University of the Philippines, Sta. Mesa",
                "birth_date": "2004-01-01"
            },
            "model": "test-mock-model",
        }

    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        # Simple validation just to pass through
        return extracted_data

    def get_provider_name(self) -> str:
        return "Dummy Testing Provider"