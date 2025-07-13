import os
import google.auth
from google import genai
from dotenv import load_dotenv

load_dotenv()

# Get credentials and project ID from the environment
try:
    credentials, project_id = google.auth.default()
    if not project_id:
        project_id = os.getenv("GCLOUD_PROJECT_ID")
except google.auth.exceptions.DefaultCredentialsError:
    raise RuntimeError(
        "Could not find default credentials. Please set up Application Default Credentials."
        "See https://cloud.google.com/docs/authentication/provide-credentials-adc for more information."
    )

GCLOUD_LOCATION = os.getenv("GCLOUD_LOCATION")
if not GCLOUD_LOCATION:
    raise ValueError("GCLOUD_LOCATION not found in .env file")

# Initialize the Vertex AI client
# This client can be shared across different services.
client = genai.Client(project=project_id, location=GCLOUD_LOCATION)

# Model for general chat and transcription
MODEL_NAME = "gemini-2.5-pro"

# Model for text-to-speech. Using a preview model as per documentation.
TTS_MODEL_NAME = "gemini-2.5-flash-preview-tts" 