import asyncio
from app.db.session import engine
from sqlalchemy import text

async def test_connection():
    try:
        # Use 'async with' for async connections
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
            print("Success: Database connection is working!")
    except Exception as e:
        print(f"Error: Could not connect to the database. Details: {e}")

# Run the async function
asyncio.run(test_connection())