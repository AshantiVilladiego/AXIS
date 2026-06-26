from abc import ABC, abstractmethod

class ModelAdapter(ABC):
    @abstractmethod
    async def process_document(self, file_data: bytes) -> dict:
        """
        Abstract method to process document bytes.
        Every provider MUST implement this.
        """
        pass