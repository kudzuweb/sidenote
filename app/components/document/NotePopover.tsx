import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Form } from "react-router";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function NotePopover({
  docId,
  id,
  x,
  y,
  quote,
  note,
  onClose,
}: {
  docId: string;
  id: string;
  x: number;
  y: number;
  quote: string;
  note: string;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = (e: PointerEvent) => {
      const el = popRef.current;
      if (!el) return;

      // Prefer composedPath to handle portals/shadow DOM correctly
      const path = (e.composedPath?.() ?? []) as EventTarget[];
      if (path.includes(el) || (e.target && el.contains(e.target as Node))) {
        // Click started inside the popover → do not close
        return;
      }
      onClose();
    };

    // Keep capture=true so outside clicks still win, but we now guard inside clicks
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [onClose]);

  return (
    <div
      ref={popRef}
      className="fixed bg-sidebar/95 backdrop-blur-md border-2 border-accent/30 p-3 shadow-[0_0_30px_rgba(0,0,0,0.4),0_0_60px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] z-10 w-[320px] overflow-hidden group"
      style={{ left: x, top: y, borderRadius: 2 }}
      role="dialog"
      aria-label="Annotation"
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
        }}
      />
      <div
        className="absolute top-0 right-0 w-[2px] h-full bg-gradient-to-b from-accent/40 via-accent/20 to-transparent"
      />
      <div
        className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-accent/40 via-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      <div className="relative z-10 space-y-3">
        <p className="text-sm font-mono leading-relaxed border-l-2 border-accent/50 pl-3 break-words">
          {note || <span className="text-muted-foreground/60 italic">// no note saved</span>}
        </p>

        <Form method="post" action={`/workspace/delete-annotation/${docId}/${id}`} className="flex justify-end border-t border-border/30 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                type="submit"
                className="h-8 w-8 hover:bg-destructive/20 hover:border-destructive/40 transition-all hover:text-destructive"
                onPointerDownCapture={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>delete annotation</p>
            </TooltipContent>
          </Tooltip>
        </Form>
      </div>
    </div>
  );
}
