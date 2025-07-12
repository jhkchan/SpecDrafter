from typing import List
from bson import ObjectId
from ..database import projects_collection
from ..models import Project, ConversationEntry, SpecPhase

async def get_projects() -> List[Project]:
    projects_cursor = projects_collection.find().sort("updatedAt", -1)
    return [Project(**project) async for project in projects_cursor]

async def get_project(project_id: str) -> Project | None:
    project = await projects_collection.find_one({"_id": ObjectId(project_id)})
    if project:
        return Project(**project)
    return None

async def create_project(project: Project) -> Project:
    result = await projects_collection.insert_one(project.model_dump(by_alias=True))
    created_project = await projects_collection.find_one({"_id": result.inserted_id})
    return Project(**created_project)

async def update_project_conversation(project_id: str, conversation_entry: ConversationEntry):
    await projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$push": {"conversation_history": conversation_entry.model_dump(by_alias=True)}}
    )

async def update_project_phase(project_id: str, new_phase: SpecPhase):
    """
    Updates the specification phase of a project.
    """
    await projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": {"current_phase": new_phase.value}}
    )

async def delete_project(project_id: str):
    result = await projects_collection.delete_one({"_id": ObjectId(project_id)})
    if result.deleted_count == 0:
        # This could be logged or handled as needed
        print(f"Warning: Project with ID {project_id} not found for deletion.")

async def update_project(project_id: str, updates: dict) -> Project | None:
    await projects_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": updates}
    )
    updated_project = await projects_collection.find_one({"_id": ObjectId(project_id)})
    if updated_project:
        return Project(**updated_project)
    return None 