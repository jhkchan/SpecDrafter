import { Project } from "./types";
import { dispatchPhaseUpdate } from "./events";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch project.");
  }
  return response.json();
}

export async function getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects/`);
    if (!response.ok) {
        throw new Error("Failed to fetch projects");
    }
    return response.json();
}

export async function createProject(): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error("Failed to create project");
    }
    return response.json();
}

export async function updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error("Failed to update project.");
  }
  return response.json();
}

export async function deleteProject(projectId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        throw new Error("Failed to delete project");
    }
}

export async function renameProject(projectId: string, newName: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/rename`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName }),
    });
    if (!response.ok) {
        throw new Error("Failed to rename project");
    }
    return response.json();
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  data?: {
    audio?: string;
    mimeType?: string;
  }
}

export async function streamChat(
  projectId: string,
  messages: { role: "user" | "assistant"; content: string; data?: any }[],
  onChunk: (chunk: string) => void,
  onDone?: (project: Project) => void,
  onError?: (error: string) => void
) {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || "Failed to start chat stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep the last, potentially incomplete line

      for (const line of lines) {
        if (line.trim() === "") continue;
        
        let chunk = line;
        if (chunk.includes("[PHASE_COMPLETE]")) {
          chunk = chunk.replace("[PHASE_COMPLETE]", "");
          dispatchPhaseUpdate();
        }
        
        if (chunk) {
          onChunk(chunk);
        }
      }
    }
    
    // Process any remaining data in the buffer
    if (buffer.trim()) {
        let chunk = buffer;
        if (chunk.includes("[PHASE_COMPLETE]")) {
          chunk = chunk.replace("[PHASE_COMPLETE]", "");
          dispatchPhaseUpdate();
        }
        if (chunk) {
            onChunk(chunk);
        }
    }

    if (onDone) {
      const finalProject = await getProject(projectId);
      onDone(finalProject);
    }
  } catch (error: any) {
    if (onError) {
      onError(error.message || "An unknown error occurred.");
    } else {
      console.error("Chat stream error:", error);
    }
  }
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/audio/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64, mime_type: mimeType }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Audio transcription failed: ${errorText}`);
    }

    const data = await response.json();
    return data.transcript;
}

export async function textToSpeech(text: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/audio/text-to-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Text-to-speech failed: ${errorText}`);
  }

  const data = await response.json();
  return data.audio_content;
} 