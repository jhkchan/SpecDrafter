"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Chat } from "@/components/chat"
import { ProgressTracker } from "@/components/progress-tracker"
import { getProjects, createProject, getProject, streamPrd } from "@/lib/api"
import { Project } from "@/lib/types"
import { PHASE_UPDATE_EVENT } from "@/lib/events"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { PrdViewer } from "@/components/prd-viewer"

export default function Home() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [activeProject, setActiveProject] = React.useState<Project | null>(null);
  const [isCreatingProject, setIsCreatingProject] = React.useState(false);
  const [isPrdViewerOpen, setIsPrdViewerOpen] = React.useState(false);
  const [generatedPrdContent, setGeneratedPrdContent] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

  const fetchProjects = React.useCallback(async (newProjectIdToSelect?: string) => {
    try {
        const fetchedProjects = await getProjects();
        setProjects(fetchedProjects);

        let projectToSelect = null;
        if (newProjectIdToSelect) {
            projectToSelect = fetchedProjects.find(p => p._id === newProjectIdToSelect);
        } else if (activeProject) {
            projectToSelect = fetchedProjects.find(p => p._id === activeProject._id);
        } else if (fetchedProjects.length > 0) {
            projectToSelect = fetchedProjects[0];
        }
        
        setActiveProject(projectToSelect || null);

    } catch (error) {
        console.error("Failed to fetch projects:", error);
        setProjects([]);
        setActiveProject(null);
    }
  }, [activeProject?._id]);

  const handleCreateProject = async () => {
    setIsCreatingProject(true);
    try {
        const newProject = await createProject();
        await fetchProjects(newProject._id);
    } catch (error) {
        console.error("Failed to create project:", error);
    } finally {
        setIsCreatingProject(false);
    }
  };

  const handleGeneratePrd = async () => {
    if (!activeProject) return;
    
    setIsGenerating(true);
    setGeneratedPrdContent(""); // Clear previous content
    
    await streamPrd(
        activeProject._id,
        (chunk) => {
            setGeneratedPrdContent(prev => prev + chunk);
        },
        () => {
            setIsGenerating(false);
            setIsPrdViewerOpen(true);
        },
        (error) => {
            console.error("Failed to generate PRD:", error);
            // You could add a user-facing error message here
            setGeneratedPrdContent("# Generation Error\n\nAn error occurred while generating the document. Please check the console for details.");
            setIsGenerating(false);
            setIsPrdViewerOpen(true);
        }
    );
  };

  const fetchActiveProject = React.useCallback(async () => {
    if (activeProject?._id) {
      try {
        const updatedProject = await getProject(activeProject._id);
        setActiveProject(updatedProject);
        setProjects(prevProjects => 
            prevProjects.map(p => p._id === updatedProject._id ? updatedProject : p)
        );
      } catch (error) {
        console.error("Failed to re-fetch active project", error);
        await fetchProjects();
      }
    }
  }, [activeProject?._id, fetchProjects]);

  React.useEffect(() => {
    fetchProjects();
  }, []);

  React.useEffect(() => {
    window.addEventListener(PHASE_UPDATE_EVENT, fetchActiveProject);
    return () => {
      window.removeEventListener(PHASE_UPDATE_EVENT, fetchActiveProject);
    };
  }, [fetchActiveProject]);

  return (
    <main className="flex h-screen bg-background">
      <SidebarProvider>
        <AppSidebar
          projects={projects}
          activeProject={activeProject}
          setActiveProject={setActiveProject}
          onCreateProject={handleCreateProject}
          onProjectsUpdate={fetchProjects}
          isCreatingProject={isCreatingProject}
        />
        <SidebarInset className="flex flex-col h-full">
            <header className="flex shrink-0 items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-6" />
                <ProgressTracker activeProject={activeProject} />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleGeneratePrd} disabled={!activeProject || isGenerating}>
                    {isGenerating ? "Generating..." : "Generate"}
                </Button>
                <ModeToggle />
              </div>
            </header>
            <div className="flex-1 overflow-hidden">
              <Chat activeProject={activeProject} onProjectsUpdate={fetchProjects} />
            </div>
        </SidebarInset>
      </SidebarProvider>
      <PrdViewer
        isOpen={isPrdViewerOpen}
        onClose={() => setIsPrdViewerOpen(false)}
        prdContent={generatedPrdContent}
        projectName={activeProject?.name || "Project"}
      />
    </main>
  )
}
