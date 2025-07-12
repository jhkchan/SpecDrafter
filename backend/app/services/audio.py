from fastapi import HTTPException
import base64
from ..client import client, MODEL_NAME, TTS_MODEL_NAME
from google.genai.types import (
    Part,
    File,
    GenerateContentConfig,
    SpeechConfig,
    VoiceConfig,
    PrebuiltVoiceConfig,
)
import tempfile
import os
import io
import wave
from pydub import AudioSegment


def process_audio_input(audio_base64: str, mime_type: str) -> str:
    """
    Processes base64 encoded audio. If it's not in a format supported by Gemini,
    it converts it to WAV, then uploads it and gets a transcript.
    """
    audio_bytes = base64.b64decode(audio_base64)
    
    source_path = None
    converted_path = None
    audio_file = None

    try:
        # Save the original audio to a temporary file
        source_suffix = mime_type.split("/")[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{source_suffix}") as tmp_file:
            source_path = tmp_file.name
            tmp_file.write(audio_bytes)

        upload_path = source_path
        upload_mime_type = mime_type
        
        # Convert to WAV if the original format is not directly supported
        if mime_type.lower() not in ["audio/wav", "audio/mp3", "audio/flac", "audio/aac", "audio/ogg"]:
            print(f"Unsupported format '{mime_type}', converting to WAV.")
            audio = AudioSegment.from_file(source_path)
            
            # Create a new temporary file for the WAV audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as converted_file:
                converted_path = converted_file.name
                audio.export(converted_path, format="wav")
            
            upload_path = converted_path
            upload_mime_type = "audio/wav"


        # Upload the (potentially converted) file
        print(f"Uploading file for transcription: {upload_path}")
        audio_file = client.files.upload(file=upload_path)
        print(f"Completed file upload: {audio_file.name}, State: {audio_file.state}")

        # Wait for the file to be ready
        while audio_file.state.name != "ACTIVE":
            if audio_file.state.name == "FAILED":
                raise Exception(f"Audio file processing failed on the server. Details: {audio_file.state_reason}")
            audio_file = client.files.get(name=audio_file.name)

        # Transcribe the audio
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[
                "Transcribe this audio. If there is no speech, return an empty string.",
                audio_file,
            ],
        )

        return response.text

    except Exception as e:
        print(f"Error processing audio: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process audio file: {e}"
        )
    finally:
        # Clean up all temporary files and cloud resources
        if audio_file:
            try:
                client.files.delete(name=audio_file.name)
            except Exception as cleanup_e:
                print(f"Error during cloud file cleanup: {cleanup_e}")
        if source_path and os.path.exists(source_path):
            os.remove(source_path)
        if converted_path and os.path.exists(converted_path):
            os.remove(converted_path)


def generate_speech_audio(text: str) -> str:
    """
    Generates speech from text using Gemini TTS and returns it as a base64 encoded string.
    The audio is raw PCM, which we encode into a WAV format before base64 encoding.
    """
    try:
        response = client.models.generate_content(
            model=TTS_MODEL_NAME,
            contents=text,
            config=GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=SpeechConfig(
                    voice_config=VoiceConfig(
                        prebuilt_voice_config=PrebuiltVoiceConfig(
                            voice_name="Puck",
                        )
                    )
                ),
            ),
        )

        raw_audio_data = response.candidates[0].content.parts[0].inline_data.data

        if not raw_audio_data:
            raise HTTPException(
                status_code=500,
                detail="Speech synthesis failed, no audio content received.",
            )

        # The API returns raw PCM data. We must package it into a WAV container
        # before sending to the browser, which expects a proper audio file format.
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)  # Mono channel
            wf.setsampwidth(2)  # 16-bit samples
            wf.setframerate(24000)  # 24kHz sample rate
            wf.writeframes(raw_audio_data)

        wav_data = wav_buffer.getvalue()

        return base64.b64encode(wav_data).decode("utf-8")

    except Exception as e:
        print(f"An error occurred during speech synthesis: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to synthesize speech: {str(e)}"
        ) 