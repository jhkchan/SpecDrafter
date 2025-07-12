from fastapi import APIRouter, HTTPException, Depends
from ..models import (
    TextToSpeechRequest,
    TextToSpeechResponse,
    TranscribeRequest,
)
from ..services.audio import generate_speech_audio, process_audio_input

router = APIRouter(
    prefix="/audio",
    tags=["audio"],
)

@router.post("/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribes audio and returns the text.
    """
    try:
        transcript = process_audio_input(request.audio, request.mime_type)
        return {"transcript": transcript}
    except Exception as e:
        print(f"Error in transcribe endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to transcribe audio.")

@router.post("/text-to-speech", response_model=TextToSpeechResponse)
async def text_to_speech(request: TextToSpeechRequest):
    """
    Synthesizes speech from text and returns it as a base64 encoded audio string.
    """
    try:
        audio_content = generate_speech_audio(request.text)
        return TextToSpeechResponse(audio_content=audio_content)
    except Exception as e:
        # Log the exception for debugging
        print(f"Error in text-to-speech endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to synthesize speech.") 