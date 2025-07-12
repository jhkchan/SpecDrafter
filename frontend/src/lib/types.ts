export interface ConversationEntry {
  role: string;
  content: string;
  data?: {
    audio?: string;
    mimeType?: string;
  };
  timestamp: string;
}

export interface RequirementsVersion {
  version: string;
  content: string;
  created_at: string;
}

export type SpecPhase =
  | "Foundation"
  | "Features & User Stories"
  | "Functional Requirements"
  | "Non-Functional Requirements"
  | "Technical Context"
  | "Completed";

export interface Project {
  _id: string;
  name: string;
  description: string;
  conversation_history: {
    role: "user" | "assistant";
    content: string;
    data?: any;
  }[];
  current_phase: string;
  requirements: any;
  createdAt: string;
  updatedAt: string;
} 