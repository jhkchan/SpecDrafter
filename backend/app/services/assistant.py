import os
import json
from typing import List, Dict, Any, Generator
from ..models import ConversationEntry, SpecPhase
from fastapi import HTTPException
from google.genai.types import Content, Part, Blob, GenerationConfig, GenerateContentConfig, ThinkingConfig
from datetime import datetime
import base64
from .audio import process_audio_input
from . import project_service
from ..client import client, MODEL_NAME
import re

SYSTEM_PROMPT = """
You are SpecDrafter, a friendly and expert AI business analyst. Your goal is to guide the user through a structured process to create a complete Product Requirements Document (PRD).

The process has 5 phases:
1.  **Foundation**: Understand the core purpose, target users, and main goals of the application.
2.  **Features & User Stories**: Define the key features and write user stories for them.
3.  **Functional Requirements**: Detail the specific functionalities and how the system should behave.
4.  **Non-Functional Requirements**: Specify system-level constraints like performance, security, and usability.
5.  **Technical Context**: Outline the proposed tech stack and development environment.

You must guide the user one phase at a time. Ask clarifying questions to get all the necessary details for the current phase.

**IMPORTANT**: When you are confident that you have gathered all the necessary information for the current phase, you MUST end your response with the exact token: `[PHASE_COMPLETE]`. Do not add any text after this token.

If the user wants to rename the project, you MUST end your response with the exact token: `[RENAME_PROJECT: "The New Project Name"]`.
"""

async def advance_project_phase(project_id: str):
    """
    Advances the project to the next specification phase.
    """
    try:
        project = await project_service.get_project(project_id)
        if not project:
            return

        current_phase = project.current_phase
        phases = list(SpecPhase)
        
        try:
            current_index = phases.index(current_phase)
            if current_index < len(phases) - 1:
                next_phase = phases[current_index + 1]
                await project_service.update_project_phase(project_id, next_phase)
                print(f"Advanced project {project_id} from {current_phase.value} to {next_phase.value}")
        except ValueError:
            print(f"Project {project_id} has an unknown phase: {current_phase}")

    except Exception as e:
        print(f"Error advancing project phase for {project_id}: {e}")


async def stream_chat_response(project_id: str, history: list[dict]):
    """
    Returns a generator for the Gemini model response stream.
    Handles both text and audio input.
    """
    system_message = [
        Content(role="user", parts=[Part(text=SYSTEM_PROMPT)]),
        Content(role="model", parts=[Part(text="Understood. I am SpecDrafter, and I will follow these instructions to help create a Product Requirements Document. I will start by focusing on the Foundation phase. Let's begin.")] )
    ]

    # Reconstruct history for the model
    history_for_model = []
    for message in history[:-1]:  # Process all but the last message
        role = "user" if message["role"] == "user" else "model"
        history_for_model.append(Content(role=role, parts=[Part(text=message["content"])]))

    # The last message from the user is the prompt
    last_message = history[-1]
    prompt_parts = []
    transcribed_text = ""

    # Check for audio data in the last message
    if 'data' in last_message and 'audio' in last_message['data']:
        audio_base64 = last_message['data']['audio']
        mime_type = last_message['data'].get('mimeType', 'audio/webm') # Defaulting to webm
        transcribed_text = process_audio_input(audio_base64, mime_type)

    # Add text content if it exists
    if last_message['content']:
        prompt_parts.append(Part(text=last_message['content']))

    # Add transcribed text if it exists
    if transcribed_text:
        prompt_parts.append(Part(text=f"\n\n[USER'S VOICE TRANSCRIPT]: {transcribed_text}"))

    # Add the phase prompt
    project = await project_service.get_project(project_id)
    current_phase = project.current_phase if project else SpecPhase.FOUNDATION
    phase_prompt = f"\n\n[SYSTEM] We are currently in the **{current_phase.value}** phase. Please continue gathering information for this phase."
    prompt_parts.append(Part(text=phase_prompt))

    # Create the full prompt with history
    contents = system_message + history_for_model + [Content(role="user", parts=prompt_parts)]

    # Enable the "thinking" feature as per the latest Gemini API docs
    config = GenerateContentConfig(
        thinking_config=ThinkingConfig(
            include_thoughts=True
        )
    )

    response_stream = client.models.generate_content_stream(
        model=MODEL_NAME,
        contents=contents,
        config=config
    )

    full_response_text = ""
    full_thoughts = ""

    for chunk in response_stream:
        if not chunk.candidates:
            continue
        # According to the doc, iterate through parts and check the `thought` attribute.
        for part in chunk.candidates[0].content.parts:
            if not part.text:
                continue
            
            if hasattr(part, 'thought') and part.thought:
                thought_text = part.text
                if thought_text:
                    full_thoughts += thought_text
                    data = {"type": "thought", "content": thought_text}
                    yield f'data: {json.dumps(data)}\n\n'
            else: # This is a regular text part
                text_to_send = part.text
                if "[PHASE_COMPLETE]" in text_to_send:
                    print(f"Phase complete signal received for project {project_id}")
                    text_to_send = text_to_send.replace("[PHASE_COMPLETE]", "")
                    await advance_project_phase(project_id)
                    # Also yield the phase complete signal to the client
                    yield f'data: {json.dumps({"type": "phase_complete"})}\n\n'

                if text_to_send:
                    full_response_text += text_to_send
                    data = {"type": "text", "content": text_to_send}
                    yield f'data: {json.dumps(data)}\n\n'
        
    if full_response_text:
        assistant_entry = ConversationEntry(
            role="assistant", 
            content=full_response_text.strip(),
            data={"thoughts": full_thoughts.strip()} if full_thoughts else {}
        )
        await project_service.update_project_conversation(project_id, assistant_entry)


def get_edit_stream(current_requirements: str, edit_instruction: str) -> Generator[str, None, None]:
    """
    Generates a stream of an edited requirements document.
    """
    system_instruction = (
        "You are an expert technical writer. Your task is to revise a software requirements document based on a user's instruction. "
        "You will be given the current document in Markdown format and an instruction for what to change. "
        "Your goal is to apply the change seamlessly and return the ENTIRE, updated document. "
        "Ensure the output is only the Markdown document, with no additional conversational text, introductions, or apologies."
    )

    system_message = [
        Content(role="user", parts=[Part(text=system_instruction)]),
        Content(role="model", parts=[Part(text="Understood. I will revise the document according to the user's instructions and return only the complete, updated Markdown.")])
    ]

    contents = system_message + [
        Content(role="user", parts=[
            Part(text=f"Here is the current document:\n\n---\n\n{current_requirements}\n\n---\n\nPlease apply this instruction: {edit_instruction}")
        ])
    ]

    response_stream = client.models.generate_content_stream(
        model=MODEL_NAME,
        contents=contents,
    )
    for response in response_stream:
        yield response.text


def get_prd_stream(conversation_history: List[ConversationEntry], target: str) -> Generator[str, None, None]:
    """
    Generates a stream of a full PRD in Markdown.
    """
    current_date = datetime.now().strftime("%B %d, %Y")

    system_instruction = (
        "You are an expert product manager and technical writer. Your task is to analyze the following conversation, which contains the complete requirements gathering dialogue for a software project. "
        f"From this conversation, generate a complete, developer-ready Product Requirements Document (PRD) for the target generative AI coding environment: **{target}**. "
        "The goal is for this PRD to be used by that AI to code the entire system. "
        "The document should be well-structured, using Markdown for formatting (headings, lists, bold text, etc.). "
        "Structure the PRD with the following sections: Introduction, User Personas, User Stories, Functional Requirements, Non-Functional Requirements, and Out of Scope. "
        "Ensure all requirements discussed in the conversation are captured accurately and in detail. "
        "It is critical that you only output the Markdown for the PRD, without any additional conversational text, introductions, or explanations. The response should start directly with the first line of the Markdown document (e.g., '# Product Requirements Document: ...')."
    )
    system_message = [
        Content(role="user", parts=[Part(text=system_instruction)]),
        Content(role="model", parts=[Part(text="Understood. I will analyze the conversation and generate a complete, developer-ready PRD in Markdown with the specified sections, starting directly with the document's content.")])
    ]

    history_text = "\n\n".join([f"{entry.role}: {entry.content}" for entry in conversation_history])
    prompt = f"**Date:** {current_date}\n\n**Conversation History:**\n{history_text}"

    contents = system_message + [Content(role="user", parts=[Part(text=prompt)])]

    response_stream = client.models.generate_content_stream(
        model=MODEL_NAME,
        contents=contents,
    )
    for response in response_stream:
        yield response.text


def get_review_stream(conversation_history: List[ConversationEntry]) -> Generator[str, None, None]:
    """
    Generates a stream of text reviewing the project requirements.
    """
    system_instruction = (
        "You are an expert system analyst. Your task is to review the following conversation history between an AI assistant and a user who is defining software requirements. "
        "Based *only* on the conversation provided, generate a concise, well-structured summary of the project's requirements. "
        "Organize the summary into logical sections (e.g., Overview, User Personas, Key Features, Technical Stack). "
        "The output should be in Markdown format. Do not add any conversational fluff or introductory sentences. Begin the response directly with the Markdown summary."
    )
    system_message = [
        Content(role="user", parts=[Part(text=system_instruction)]),
        Content(role="model", parts=[Part(text="Understood. I will review the conversation and generate a concise, well-structured summary of the project's requirements in Markdown format, starting directly with the summary.")])
    ]
    conversation_text = "\n\n---\n\n".join(
        [f"**{entry.role.capitalize()}**: {entry.content}" for entry in conversation_history]
    )
    prompt = f"Here is the conversation history:\n\n{conversation_text}"

    contents = system_message + [Content(role="user", parts=[Part(text=prompt)])]

    response_stream = client.models.generate_content_stream(
        model=MODEL_NAME,
        contents=contents,
    )
    for response in response_stream:
        yield response.text 