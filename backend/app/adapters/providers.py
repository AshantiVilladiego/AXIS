import asyncio
from app.adapters.base import ModelAdapter

class GeminiAdapter(ModelAdapter):
    async def process_document(self, file_data: bytes) -> dict:
        try:
            # Simulate API call with a 10-second timeout
            # Replace 'await self._call_gemini' with real API call
            return await asyncio.wait_for(self._call_gemini(file_data), timeout=10.0)
        except asyncio.TimeoutError:
            raise Exception("Gemini API connection timed out.")
        except Exception as e:
            raise Exception(f"Gemini API Error: {str(e)}")

    async def _call_gemini(self, file_data: bytes):
        await asyncio.sleep(1)  # Simulated latency
        return {"provider": "gemini", "status": "success", "data": "extracted_content"}

class GroqAdapter(ModelAdapter):
    async def process_document(self, file_data: bytes) -> dict:
        try:
            return await asyncio.wait_for(self._call_groq(file_data), timeout=10.0)
        except asyncio.TimeoutError:
            raise Exception("Groq API connection timed out.")
        except Exception as e:
            raise Exception(f"Groq API Error: {str(e)}")

    async def _call_groq(self, file_data: bytes):
        await asyncio.sleep(0.5) # Simulated latency
        return {"provider": "groq", "status": "success", "data": "extracted_content"}