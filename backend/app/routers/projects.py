import re
import json
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List
from ..services import project_service, assistant
from ..models import Project, ConversationEntry, RequirementsVersion, SpecPhase, EditRequest, GeneratePrdRequest
from pydantic import BaseModel

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)

@router.post("/", response_model=Project, response_model_by_alias=True)
async def create_new_project():
    new_project = Project()
    # Add initial welcome message to conversation history
    welcome_message = ConversationEntry(
        role="assistant",
        content="Welcome to SpecDrafter! I'm here to help you draft your project requirements. Let's start with the first phase: **Foundation**. What is the core purpose of your application? Who are the target users?"
    )
    new_project.conversation_history.append(welcome_message)
    
    created_project = await project_service.create_project(new_project)
    if not created_project:
        raise HTTPException(status_code=500, detail="Failed to create project")
    return created_project

@router.get("/", response_model=List[Project], response_model_by_alias=True)
async def list_projects():
    """
    Retrieve all projects.
    """
    return await project_service.get_projects()

@router.get("/{project_id}", response_model=Project, response_model_by_alias=True)
async def get_project_details(project_id: str):
    """
    Retrieve a single project by its ID.
    """
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.patch("/{project_id}", response_model=Project, response_model_by_alias=True)
async def update_project_details(project_id: str, updates: dict):
    """
    Update project details, like its name.
    """
    updated_project = await project_service.update_project(project_id, updates)
    if not updated_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return updated_project

@router.post("/{project_id}/chat")
async def stream_chat(project_id: str, request: Request):
    try:
        body = await request.json()
        messages = body.get("messages", [])

        if not messages:
            raise HTTPException(status_code=400, detail="No messages provided")

        # The last message is the user's current message.
        user_message = messages[-1]

        # Ensure the project exists before doing anything else.
        project = await project_service.get_project(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Create a ConversationEntry to save to the database.
        entry_content = user_message.get("content")
        entry_data = user_message.get("data")

        # If there's no text content, it's an audio-only message.
        if entry_content is None and entry_data and "audio" in entry_data:
            entry_content = "[audio input]"
        elif entry_content is None:
            # This case should ideally not happen if validation is correct on the client
            raise HTTPException(status_code=400, detail="Message content is missing.")

        user_entry = ConversationEntry(
            role="user",
            content=entry_content,
            data=entry_data
        )
        await project_service.update_project_conversation(project_id, user_entry)

        # The `messages` from the request body already contains the full history
        # needed for the assistant, which expects a list of dictionaries.
        return StreamingResponse(
            assistant.stream_chat_response(project_id, messages),
            media_type="text/plain"
        )

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in request body.")
    except Exception as e:
        print(f"Error during chat streaming: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error during chat: {e}")


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_by_id(project_id: str):
    await project_service.delete_project(project_id)

@router.post("/{project_id}/edit-requirements")
async def edit_requirements(project_id: str, req: EditRequest):
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Assuming the 'content' field in requirements is what we're editing.
    # This might need to be adjusted based on the actual structure of `project.requirements`.
    current_requirements = project.requirements.get("content", "")

    return StreamingResponse(
        assistant.get_edit_stream(current_requirements, req.content),
        media_type="text/plain"
    )

@router.post("/{project_id}/generate-prd")
async def generate_prd(project_id: str, req: GeneratePrdRequest):
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return StreamingResponse(
        assistant.get_prd_stream(project.conversation_history, req.target),
        media_type="text/plain"
    )

@router.post("/{project_id}/review")
async def review_requirements(project_id: str):
    project = await project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return StreamingResponse(
        assistant.get_review_stream(project.conversation_history),
        media_type="text/plain"
    ) 