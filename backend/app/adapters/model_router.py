import logging
from app.adapters.dummy import DummyAdapter

from app.adapters.providers import (
    GeminiAdapter, GroqAdapter, HFAdapter, ProviderUnavailableError
)

class ModelRouter:
    def __init__(self):
        # Provider priority order for extraction.
        # It will try them in this exact order until one succeeds.
        self.providers = [
            # DummyAdapter(),
            GeminiAdapter(),     # 1. Primary AI
            GroqAdapter(),       # 2. Fast AI Backup
            HFAdapter(),         # 3. Open Source AI Backup
        ]
        self.logger = logging.getLogger(__name__)

    async def route_process_document(self, file_data: bytes, file_type: str):
        """
        Orchestrates the AI processing with automated failover.
        """
        failures = []

        for provider in self.providers:
            try:
                self.logger.info(f"Attempting processing with {provider.get_provider_name()}...")
                return await provider.process_document(file_data, file_type)

            except ProviderUnavailableError as e:
                message = f"{provider.get_provider_name()} unavailable: {str(e)}"
                self.logger.warning(message)
                failures.append(message)
                continue

            except Exception as e:
                message = f"{provider.get_provider_name()} failed: {str(e)}"
                self.logger.error(message)
                failures.append(message)
                continue

        failure_summary = " | ".join(failures) if failures else "No providers attempted."
        raise Exception(f"Critical Failure: All AI providers failed to process the document. {failure_summary}")