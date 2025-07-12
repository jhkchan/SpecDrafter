from pydantic import BaseModel, Field, BeforeValidator, field_validator, ConfigDict
from typing import List, Optional, Annotated
from bson import ObjectId
from enum import Enum
from datetime import datetime

# This is the correct Pydantic v2 way to handle ObjectIds.
PyObjectId = Annotated[
    str,
    BeforeValidator(str),
]

class SpecPhase(str, Enum):
    FOUNDATION = "Foundation"
    FEATURES = "Features & User Stories"
    FUNCTIONAL_REQ = "Functional Requirements"
    NON_FUNCTIONAL_REQ = "Non-Functional Requirements"
    TECHNICAL_CONTEXT = "Technical Context"
    COMPLETED = "Completed"

class ConversationEntry(BaseModel):
    role: str
    content: str
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.now)

    @field_validator('timestamp', mode='before')
    @classmethod
    def parse_timestamp(cls, v):
        if isinstance(v, str):
            try:
                # Handle ISO format, including 'Z' for UTC
                if v.endswith('Z'):
                    return datetime.fromisoformat(v[:-1] + '+00:00')
                return datetime.fromisoformat(v)
            except ValueError:
                # Fallback for other potential string formats if needed
                raise ValueError(f"Unable to parse timestamp string: {v}")
        return v

class RequirementsVersion(BaseModel):
    version: str = "1.0"
    content: str
    created_at: datetime = Field(default_factory=datetime.now)

    @field_validator('created_at', mode='before')
    @classmethod
    def parse_created_at(cls, v):
        if isinstance(v, str):
            try:
                if v.endswith('Z'):
                    return datetime.fromisoformat(v[:-1] + '+00:00')
                return datetime.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Unable to parse created_at string: {v}")
        return v


class Project(BaseModel):
    id: PyObjectId = Field(default_factory=ObjectId, alias="_id")
    name: str = "New Project"
    description: str = ""
    conversation_history: List[ConversationEntry] = []
    current_phase: SpecPhase = SpecPhase.FOUNDATION
    requirements: dict = Field(default_factory=dict)
    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    @field_validator('createdAt', 'updatedAt', mode='before')
    @classmethod
    def parse_datetimes(cls, v):
        if isinstance(v, str):
            try:
                if v.endswith('Z'):
                    return datetime.fromisoformat(v[:-1] + '+00:00')
                return datetime.fromisoformat(v)
            except ValueError:
                raise ValueError(f"Unable to parse datetime string: {v}")
        return v

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str},
    )

class ChatRequest(BaseModel):
    content: Optional[str] = None
    data: Optional[dict] = None

class EditRequest(BaseModel):
    content: str

class GeneratePrdRequest(BaseModel):
    target: str = "Cursor"

class TextToSpeechRequest(BaseModel):
    text: str

class TextToSpeechResponse(BaseModel):
    audio_content: str

class TranscribeRequest(BaseModel):
    audio: str  # Base64 encoded audio
    mime_type: str 