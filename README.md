# SpecDrafter

SpecDrafter is a web-based tool that uses a conversational AI to help users draft detailed Product Requirements Documents (PRDs). It guides users through a structured process, from foundational concepts to technical specifications, to create a comprehensive document ready for development teams.

## Features

- **Conversational AI Guide**: An expert AI assistant guides you through the 5 phases of PRD creation.
- **Structured Requirement Gathering**: Follows a clear path: Foundation, Features & User Stories, Functional Requirements, Non-Functional Requirements, and Technical Context.
- **Audio Input**: Speak your requirements directly to the application for transcription.
- **Text-to-Speech Output**: Listen to the AI assistant's responses.
- **Project Management**: Create and manage multiple specification documents.
- **Real-time PRD Viewer**: See your PRD being built as you converse with the AI.
- **Edit Functionality**: Ask the AI to make edits to the generated document.

## Tech Stack

### Frontend

- **Framework**: Next.js (v14) with Turbopack
- **Language**: TypeScript
- **UI**: React (v18)
- **Styling**: Tailwind CSS (v3)
- **Component Library**: shadcn/ui

### Backend

- **Framework**: FastAPI
- **Language**: Python
- **Database**: MongoDB (accessed with Motor)
- **AI**: Google Gemini Pro via the `google-genai` library

## Getting Started

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en) (v18.x or later recommended)
- [Python](https://www.python.org/downloads/) (v3.9 or later)
- [MongoDB](https://www.mongodb.com/try/download/community)
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd SpecDrafter
```

### 2. Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a file named `.env` in the `backend` directory and add the following variables:

    ```env
    # Your Google Cloud Project ID
    GCLOUD_PROJECT_ID="your-gcp-project-id"

    # The Google Cloud location for Vertex AI (e.g., us-central1)
    GCLOUD_LOCATION="your-gcp-location"

    # Your MongoDB connection string
    MONGO_URI="mongodb://localhost:27017/"
    ```

5.  **Authenticate with Google Cloud:**
    The application uses Application Default Credentials (ADC) to find your Google Cloud credentials. Authenticate the gcloud CLI with your user credentials:
    ```bash
    gcloud auth application-default login
    ```
    Ensure the authenticated user has the "Vertex AI User" role in your GCP project.

6.  **Run the backend server:**
    ```bash
    python run.py
    ```
    The backend API will be running at `http://localhost:8000`.

### 3. Backend Setup with Docker (Alternative)

As an alternative to running the backend manually, you can use Docker and Docker Compose to set up the backend services.

1.  **Ensure Docker is running.**

2.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```

3.  **Create your `.env` file** as described in the manual setup section above and authenticate with `gcloud auth application-default login`. The Docker container will mount your local gcloud configuration.

4.  **Build and run the containers:**
    ```bash
    docker-compose up --build
    ```
    This command will build the backend image and start the `backend` and `mongodb` containers. The backend will be available at `http://localhost:8000`.

### 4. Frontend Setup

1.  **Navigate to the frontend directory (from the root):**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:3000`.

## Usage

Once both the backend and frontend servers are running, open your web browser and navigate to `http://localhost:3000`. Click "Start New Project" to begin interacting with the AI and building your PRD.

## Project Structure

```
.
├── backend/         # FastAPI Python backend
│   ├── app/         # Core application logic
│   ├── main.py      # FastAPI app entrypoint
│   └── run.py       # Server runner
├── frontend/        # Next.js React frontend
│   ├── src/
│   │   ├── app/     # Main pages and layout
│   │   ├── components/ # React components
│   │   └── lib/     # Utility functions and types
│   └── package.json
└── README.md
``` 