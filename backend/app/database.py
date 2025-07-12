import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

client = AsyncIOMotorClient(MONGO_URI)
db = client.spec_drafter_db
projects_collection = db.get_collection("projects")


async def connect_to_mongo():
    try:
        await client.admin.command("ping")
        print("Pinged your deployment. You successfully connected to MongoDB!")
    except Exception as e:
        print(e)


async def close_mongo_connection():
    client.close()
    print("MongoDB connection closed.") 