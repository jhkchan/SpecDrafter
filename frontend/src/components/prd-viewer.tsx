import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

interface PrdViewerProps {
  prdContent: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
}

const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
        URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export function PrdViewer({ prdContent, projectName, isOpen, onClose, isGenerating }: PrdViewerProps) {
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [prdContent]);
    
  if (!isOpen) {
    return null;
  }

  const handleDownload = () => {
    const filename = `${projectName.replace(/\s+/g, '_')}_PRD.md`;
    downloadMarkdown(prdContent, filename);
  };

  const markdownComponents: Components = {
    h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
    p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc pl-6 my-4" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal pl-6 my-4" {...props} />,
    li: ({node, ...props}) => <li className="mb-2" {...props} />,
    code: ({node, ...props}) => <code className="bg-muted text-muted-foreground rounded-sm px-1 py-0.5 font-mono" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 pl-4 italic my-4" {...props} />,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Generated PRD for "{projectName}"</DialogTitle>
          <DialogDescription>
            This is the generated Product Requirements Document. You can review it here or download it as a Markdown file.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 my-4" viewportRef={scrollViewportRef}>
            <div className="p-6">
                {isGenerating && !prdContent ? (
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <br/>
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                ) : (
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
                        {prdContent}
                    </ReactMarkdown>
                )}
            </div>
        </ScrollArea>
        <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isGenerating}>Close</Button>
            <Button onClick={handleDownload} disabled={isGenerating || !prdContent}>
                {isGenerating ? 'Generating...' : <><Download className="mr-2 h-4 w-4" /> Download .md</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 