"use client"

import * as React from "react"
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "./ui/sidebar"
import { Button } from "./ui/button"
import { Plus, Trash2, Edit } from "lucide-react"
import { Project } from "@/lib/types"
import { getProjects, createProject, deleteProject, updateProject } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PHASE_UPDATE_EVENT } from "@/lib/events";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
    projects: Project[];
    activeProject: Project | null;
    setActiveProject: (project: Project | null) => void;
    onCreateProject: () => void;
    onProjectsUpdate: (newProjectId?: string) => void;
    isCreatingProject: boolean;
}

export function AppSidebar({ projects, activeProject, setActiveProject, onCreateProject, onProjectsUpdate, isCreatingProject, ...props }: AppSidebarProps) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false);
    const [projectToEdit, setProjectToEdit] = React.useState<Project | null>(null);
    const [newProjectName, setNewProjectName] = React.useState("");

    const handleProjectsUpdate = React.useCallback(() => {
        onProjectsUpdate();
    }, [onProjectsUpdate]);

    React.useEffect(() => {
        window.addEventListener(PHASE_UPDATE_EVENT, handleProjectsUpdate);
        return () => {
            window.removeEventListener(PHASE_UPDATE_EVENT, handleProjectsUpdate);
        };
    }, [handleProjectsUpdate]);

    const handleDelete = async () => {
        if (projectToEdit) {
            await deleteProject(projectToEdit._id);
            setIsDeleteDialogOpen(false);
            setProjectToEdit(null);
            // After deleting, refresh the projects list.
            // The main page will handle setting the new active project.
            onProjectsUpdate();
        }
    };
    
    const handleRename = async () => {
        if (projectToEdit && newProjectName) {
            const updated = await updateProject(projectToEdit._id, { name: newProjectName });
            setIsRenameDialogOpen(false);
            setProjectToEdit(null);
            setNewProjectName("");
            // Refresh the list to show the new name
            onProjectsUpdate(updated._id);
        }
    };
  
  return (
    <>
        <Sidebar {...props}>
            <SidebarHeader>
                <div className="flex flex-col gap-4 p-4">
                    <h2 className="text-xl font-semibold">SpecDrafter</h2>
                    <Button onClick={onCreateProject} size="sm" disabled={isCreatingProject}>
                        <Plus className="mr-2 h-4 w-4" /> New Project
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2 p-4">
                    {projects.map(project => (
                        <div key={project._id} className="group flex items-center">
                            <Button
                                variant={activeProject?._id === project._id ? "secondary" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setActiveProject(project)}
                            >
                                {project.name}
                            </Button>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setProjectToEdit(project); setIsRenameDialogOpen(true); setNewProjectName(project.name); }}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setProjectToEdit(project); setIsDeleteDialogOpen(true); }}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </SidebarContent>
            <SidebarFooter>
                {/* Footer content if any */}
            </SidebarFooter>
        </Sidebar>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                        This will permanently delete the project "{projectToEdit?.name}". This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename Project</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsRenameDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleRename}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </>
  )
}
