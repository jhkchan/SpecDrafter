"use client"

import * as React from "react"
import { Project } from "@/lib/types";
import { CheckCircle2, CircleDot, Circle, ChevronRight } from "lucide-react";

const phases = [
  "Foundation",
  "Features & User Stories",
  "Functional Requirements",
  "Non-Functional Requirements",
  "Technical Context",
  "Completed",
];

interface ProgressTrackerProps {
  activeProject: Project | null;
}

export function ProgressTracker({ activeProject }: ProgressTrackerProps) {
  const currentIndex = activeProject ? phases.indexOf(activeProject.current_phase) : -1;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {phases.map((phase, index) => {
        const isDone = currentIndex > index;
        const isDoing = currentIndex === index;
        
        let Icon = Circle; // Not Done
        if (isDone) Icon = CheckCircle2; // Done
        if (isDoing) Icon = CircleDot; // Doing

        return (
          <React.Fragment key={phase}>
            <div className="flex items-center gap-1.5">
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isDoing
                    ? "text-primary"
                    : isDone
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              />
              <span
                className={
                  isDoing
                    ? "font-semibold text-primary"
                    : isDone
                    ? "text-foreground"
                    : "text-muted-foreground"
                }
              >
                {phase}
              </span>
            </div>
            {index < phases.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
} 