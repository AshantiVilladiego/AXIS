import asyncio
import asyncpg

async def run():
    print("Attempting to connect to Supabase...")
    try:
        conn = await asyncpg.connect(
            host="aws-1-ap-southeast-1.pooler.supabase.com",
            port=5432,
            user="postgres.atwdobxtgsmumswhrviu",
            password="axisbyyearners",
            database="postgres",
            ssl="disable",
        )
        print("--- SUCCESS: Connected to Supabase perfectly! ---")
        version = await conn.fetchval("SELECT version();")
        print(f"Database Version: {version}")
        await conn.close()
    except Exception as e:
        print(f"--- FAILURE: Connection failed ---")
        print(f"Error type: {type(e).__name__}")
        print(f"Error details: {e}")

asyncio.run(run())