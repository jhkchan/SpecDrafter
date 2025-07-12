"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Bot, Mic, Send, User, Volume2, Square } from "lucide-react"
import { Project } from "@/lib/types"
import { streamChat, textToSpeech, transcribeAudio, Message as ApiMessage } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Message = ApiMessage;

interface ChatProps {
    activeProject: Project | null;
}

export function Chat({ activeProject }: ChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isRecording, setIsRecording] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentPlayingMessage, setCurrentPlayingMessage] = React.useState<string | null>(null);
  const [lastInputWasAudio, setLastInputWasAudio] = React.useState(false);

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
  
  const handlePlayText = async (message: Message) => {
    if (currentPlayingMessage === message.content) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentPlayingMessage(null);
      return;
    }
  
    setCurrentPlayingMessage(message.content);
    setIsLoading(true);
    try {
      const audioBase64 = await textToSpeech(message.content);
      const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
      handleAudioPlay(audioBlob);
    } catch (error) {
      console.error("Failed to play audio:", error);
      setCurrentPlayingMessage(null);
    } finally {
      setIsLoading(false);
    }
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
          
          setLastInputWasAudio(true);
          const tempUserMessage: Message = { role: "user", content: "[Transcribing...]" };
          const messagesWithTemp = [...messages, tempUserMessage];
          setMessages(messagesWithTemp);
          
          try {
            const transcript = await transcribeAudio(audioBase64, 'audio/webm');
            
            const finalMessages = messagesWithTemp.map(msg => 
                msg.content === "[Transcribing...]" ? { ...msg, content: transcript } : msg
            );
            setMessages(finalMessages);
            handleSendMessage(finalMessages);

          } catch (error) {
              console.error("Transcription failed:", error);
              setMessages(prev => prev.map(msg => 
                  msg.content === "[Transcribing...]" ? { ...msg, content: "[Transcription Failed]" } : msg
              ));
              setLastInputWasAudio(false);
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

  const handleSendMessage = async (messagesToSubmit: Message[]) => {
    if (isLoading || !activeProject) return;

    setIsLoading(true);

    // Add a placeholder for the assistant's response.
    const messagesWithAIPending = [...messagesToSubmit, { role: 'assistant', content: '' } as Message];
    setMessages(messagesWithAIPending);

    let fullResponse = "";
    await streamChat(
      activeProject._id,
      messagesToSubmit, // Send the clean history to the backend
      (chunk) => {
        fullResponse += chunk;
        setMessages(prev => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += chunk;
          }
          return updatedMessages;
        });
      },
      (finalProject) => {
        setIsLoading(false);
        if (lastInputWasAudio) {
          handlePlayText({ role: 'assistant', content: fullResponse });
          setLastInputWasAudio(false);
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
        setLastInputWasAudio(false);
      }
    );
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeProject) return;

    setLastInputWasAudio(false);
    const newUserMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setInput("");
    handleSendMessage(newMessages);
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