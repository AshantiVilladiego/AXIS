from abc import ABC, abstractmethod
from typing import Dict, Any

class ModelAdapter(ABC):
    """
    Abstract Base Class (Interface) for all AI providers.
    Every provider (Gemini, Groq, HF) must implement these methods.
    """

    @abstractmethod
    async def process_document(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        """
        Extracts fields from the uploaded document.
        :param file_data: The raw bytes of the file.
        :param file_type: The MIME type (e.g., 'image/jpeg', 'application/pdf').
        :return: A dictionary of extracted fields.
        """
        pass

    @abstractmethod
    async def validate_data(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates the extracted data against expected schemas/business logic.
        """
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Returns the name of the provider (e.g., 'Gemini', 'Groq', 'HuggingFace').
        Useful for logging which provider handled the request.
        """
        pass