"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Bot, Mic, Send, User, Volume2, Square } from "lucide-react"
import { Project } from "@/lib/types"
import {
  streamChat,
  textToSpeech,
  transcribeAudio,
  Message as ApiMessage,
  StreamChunk,
  updateProject,
} from "@/lib/api";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { ChevronsUpDown } from "lucide-react";

type Message = ApiMessage;

interface ChatProps {
    activeProject: Project | null;
    onProjectsUpdate: (newProjectId?: string) => void;
}

export function Chat({ activeProject, onProjectsUpdate }: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentPlayingMessage, setCurrentPlayingMessage] = React.useState<string | null>(null);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioPlayerRef = React.useRef<HTMLAudioElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
      if (activeProject) {
          setMessages(activeProject.conversation_history.map(entry => ({
              role: entry.role === 'assistant' ? 'assistant' : 'user',
              content: entry.content,
              data: entry.data
          })));
      }
  }, [activeProject]);

  React.useEffect(() => {
    if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAudioPlay = (blob: Blob) => {
    if (audioPlayerRef.current) {
      const url = URL.createObjectURL(blob);
      audioPlayerRef.current.src = url;
      audioPlayerRef.current.play();
      setIsPlaying(true);
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentPlayingMessage(null);
        URL.revokeObjectURL(url);
      };
    }
  };
  
  const handlePlayText = (message: Message): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      if (currentPlayingMessage === message.content) {
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setCurrentPlayingMessage(null);
        setIsLoading(false);
        resolve();
        return;
      }

      setCurrentPlayingMessage(message.content);
      setIsLoading(true);

      try {
        const audioBase64 = await textToSpeech(message.content);
        const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });

        if (audioPlayerRef.current) {
          const url = URL.createObjectURL(audioBlob);
          audioPlayerRef.current.src = url;
          audioPlayerRef.current.play();
          setIsPlaying(true);
          
          audioPlayerRef.current.onended = () => {
            setIsPlaying(false);
            setCurrentPlayingMessage(null);
            URL.revokeObjectURL(url);
            setIsLoading(false);
            resolve();
          };

          audioPlayerRef.current.onerror = (e) => {
            setIsPlaying(false);
            setCurrentPlayingMessage(null);
            URL.revokeObjectURL(url);
            setIsLoading(false);
            console.error("Audio playback error:", e);
            reject(e);
          };

        } else {
          setIsLoading(false);
          reject(new Error("Audio player is not available."));
        }
      } catch (error) {
        console.error("Failed to play audio:", error);
        setCurrentPlayingMessage(null);
        setIsLoading(false);
        reject(error);
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const audioBase64 = base64data.split(',')[1];
          
          const tempUserMessage: Message = { role: "user", content: "[Transcribing...]" };
          const messagesWithTemp = [...messages, tempUserMessage];
          setMessages(messagesWithTemp);
          
          try {
            const transcript = await transcribeAudio(audioBase64, 'audio/webm');
            
            const finalMessages = messagesWithTemp.map(msg => 
                msg.content === "[Transcribing...]" ? { ...msg, content: transcript } : msg
            );
            setMessages(finalMessages);
            handleSendMessage(finalMessages, true);

          } catch (error) {
              console.error("Transcription failed:", error);
              setMessages(prev => prev.map(msg => 
                  msg.content === "[Transcribing...]" ? { ...msg, content: "[Transcription Failed]" } : msg
              ));
          }
        };
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const handleMicClick = () => {
    if (isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  };

  const handleSendMessage = async (messagesToSubmit: Message[], isAudioInput: boolean) => {
    if (isLoading || !activeProject) return;

    setIsLoading(true);

    // Add a placeholder for the assistant's response.
    const messagesWithAIPending = [...messagesToSubmit, { role: 'assistant', content: '', data: { thoughts: ''} } as Message];
    setMessages(messagesWithAIPending);

    let fullResponse = "";
    let fullThoughts = "";

    await streamChat(
      activeProject._id,
      messagesToSubmit, // Send the clean history to the backend
      (chunk: StreamChunk) => {
        if (chunk.type === 'thought' && chunk.content) {
            fullThoughts += chunk.content;
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.data) {
                    const newLastMessage = { 
                        ...lastMessage, 
                        data: { ...lastMessage.data, thoughts: fullThoughts } 
                    };
                    return [...prev.slice(0, -1), newLastMessage];
                }
                return prev;
            });
        } else if (chunk.type === 'text' && chunk.content) {
            fullResponse += chunk.content;
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                    const newLastMessage = { 
                        ...lastMessage, 
                        content: lastMessage.content + chunk.content 
                    };
                    return [...prev.slice(0, -1), newLastMessage];
                }
                return prev;
            });
        }
      },
      async () => {
        setIsLoading(false); // Set loading to false once streaming is complete

        const renameMatch = fullResponse.match(/\[RENAME_PROJECT: "(.+?)"\]/);
        if (renameMatch && renameMatch[1] && activeProject) {
            const newName = renameMatch[1];
            try {
                const updated = await updateProject(activeProject._id, { name: newName });
                onProjectsUpdate(updated._id);
            } catch (error) {
                console.error("Failed to rename project from bot command:", error);
            }
        }
        
        if (isAudioInput) {
            handlePlayText({ role: 'assistant', content: fullResponse })
                .catch(e => console.error("Playback failed after stream", e));
        }
      },
      (error) => {
        setMessages(prev => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = `Error: ${error}`;
          }
          return updatedMessages;
        });
        setIsLoading(false);
      }
    );
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeProject) return;

    const newUserMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setInput("");
    handleSendMessage(newMessages, false);
  };

  return (
    <div className="flex flex-col h-full">
        <audio ref={audioPlayerRef} className="hidden" />
        <ScrollArea className="flex-1" viewportRef={viewportRef}>
            <div className="p-4">
                <div className="flex flex-col gap-6 w-full">
                {messages.map((message, index) => (
                    <div
                    key={index}
                    className={`flex items-start gap-4 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    >
                    {message.role === "assistant" && (
                        <div className="flex-shrink-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Bot size={20} />
                            </div>
                        </div>

                    )}
                    <div
                        className={`max-w-[75%] rounded-lg px-4 py-2 relative group ${
                        message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                    >
                        {message.data?.thoughts && (
                            <div className="mt-2">
                                <Collapsible defaultOpen>
                                    <CollapsibleTrigger asChild>
                                        <button className="flex items-center text-xs text-muted-foreground">
                                            <ChevronsUpDown className="h-4 w-4 mr-1" />
                                            Assistant's Thoughts
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="prose prose-sm dark:prose-invert bg-background/50 rounded-md p-2 mt-1 border">
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-4" {...props} />,
                                                    h2: ({node, ...props}) => <h2 className="text-xl font-bold my-3" {...props} />,
                                                    h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2" {...props} />,
                                                    p: ({node, ...props}) => <p className="mb-4" {...props} />,
                                                    ul: ({node, ...props}) => <ul className="list-disc pl-5 my-4" {...props} />,
                                                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-4" {...props} />,
                                                    li: ({node, ...props}) => <li className="mb-2" {...props} />,
                                                }}
                                            >
                                                {message.data.thoughts}
                                            </ReactMarkdown>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                        )}
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({node, ...props}) => <h1 className="text-2xl font-bold my-4" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-xl font-bold my-3" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-lg font-bold my-2" {...props} />,
                                p: ({node, ...props}) => <p className="mb-4" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-5 my-4" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-4" {...props} />,
                                li: ({node, ...props}) => <li className="mb-2" {...props} />,
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>

                        {message.role === 'assistant' && message.content && (
                             <Button
                                size="icon"
                                variant="ghost"
                                className="absolute -top-2 -right-2 h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handlePlayText(message)}
                                disabled={isLoading && currentPlayingMessage !== message.content}
                            >
                                <Volume2 size={16} />
                            </Button>
                        )}

                    </div>
                    {message.role === "user" && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground flex-shrink-0">
                            <User size={20} />
                        </div>
                    )}
                    </div>
                ))}
                </div>
            </div>
            <ScrollBar />
        </ScrollArea>
      <div className="border-t p-4 bg-background shrink-0">
        <form onSubmit={handleTextSubmit} className="flex items-start gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me about your project..."
            className="flex-1 min-h-[40px] max-h-40"
            disabled={isLoading || !activeProject}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit(e as unknown as React.FormEvent);
                }
            }}
          />
          <Button type="submit" disabled={isLoading || !activeProject || isRecording}>
            <Send className="h-5 w-5" />
          </Button>
          <Button type="button" variant={isRecording ? 'destructive' : 'ghost'} size="icon" disabled={isLoading || !activeProject} onClick={handleMicClick}>
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  )
} 