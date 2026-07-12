import asyncio
from app.adapters.dummy import DummyAdapter  # Ensure your DummyAdapter is here

async def main():
    # 1. Initialize the adapter you want to test
    adapter = DummyAdapter()
    
    print(f"Testing Provider: {adapter.get_provider_name()}")
    
    # 2. Simulate a file (use dummy bytes)
    dummy_file_data = b"fake-pdf-content"
    dummy_file_type = "application/pdf"
    
    # 3. Call the processing method directly
    try:
        result = await adapter.process_document(dummy_file_data, dummy_file_type)
        print("\n--- SUCCESS! ---")
        print(f"Result: {result}")
    except Exception as e:
        print(f"\n--- FAILED! ---")
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())