import { CornerDownLeft, MessageCirclePlus, MessageSquareReply } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Form } from "react-router";
import { Tweet } from "~/routes/tweet";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

type PopoverProps = {
    docId: string;
    docTitle: string;
    color: string;
    selectionText: string;
    annotationText: string;
    setAnnotationText: (v: string) => void;
    selectionRef: React.MutableRefObject<string>;
    setIncludeSelection: React.Dispatch<React.SetStateAction<boolean>>,
    // optional: position; if you want to move with selection
    x?: number;
    y?: number;
    theme: string;
    onRequestClose: () => void;
};


export function CustomPopover({
    docId,
    docTitle,
    selectionText,
    color,
    setIncludeSelection,
    selectionRef,
    onRequestClose,
    theme,
    x = 0,
    y = 0,
}: PopoverProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const hiddenRef = useRef<HTMLInputElement>(null);
    const newChatHiddenRef = useRef<HTMLInputElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            const el = rootRef.current;
            if (!el) return;
            // If click is outside the popover, close it
            if (!el.contains(e.target as Node)) {
                onRequestClose();
            }
        };
        // capture = true so we see the event even if inner handlers stopPropagation
        window.document.addEventListener("pointerdown", handlePointerDown, true);
        return () =>
            window.document.removeEventListener("pointerdown", handlePointerDown, true);
    }, [onRequestClose]);
    const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
        let parsed: any = null;
        try {
            parsed = JSON.parse(selectionRef.current);
            onRequestClose();
        } catch { }
        if (!parsed) {
            e.preventDefault();
            return;
        }

        const payload = {
            documentId: docId,
            start: parsed.start,
            end: parsed.end,
            color: color,
            quote: parsed.quote,
            prefix: parsed.prefix,
            suffix: parsed.suffix,
            body: noteRef.current?.value ?? "",
        };

        if (hiddenRef.current) hiddenRef.current.value = JSON.stringify(payload);
    };

    const [tweetSidenote, setTweetSidenote] = useState("");

    const handleCreateChatSubmit: React.FormEventHandler<HTMLFormElement> = () => {
        const selectionValue = selectionRef.current && selectionRef.current.trim().length > 0
            ? selectionRef.current
            : selectionText;

        if (newChatHiddenRef.current) {
            newChatHiddenRef.current.value = selectionValue ?? "";
        }

        if (selectionValue && selectionValue.length > 0) {
            setIncludeSelection(true);
        }

        onRequestClose();
    };

    return (
        <div
            ref={rootRef}
            className="bg-sidebar/95 text-accent-foreground backdrop-blur-md border-2 border-accent/30 relative overflow-hidden group"
            style={{
                position: "fixed",
                left: x,
                top: y,
                padding: "16px 18px",
                borderRadius: 2,
                boxShadow: "0 0 30px rgba(0,0,0,0.4), 0 0 60px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 20px rgba(255,255,255,0.02)",
                zIndex: 1000,
                width: 360,
                pointerEvents: "auto",
            }}
        >
            <div
                className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay"
                style={{
                    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
                }}
            />
            <div
                className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            />
            <div
                className="absolute bottom-0 left-0 w-[3px] h-full bg-gradient-to-b from-accent/40 via-accent/20 to-transparent"
            />
            <div className="relative z-10 flex gap-2">
                <div className="flex-1 space-y-3">
                    <p className="text-sm font-medium break-words tracking-tight leading-relaxed border-l-2 border-accent/50 pl-3 max-h-[120px] overflow-y-auto">
                        {selectionText}
                    </p>

                    <Form
                        id={`annotation-form-${docId}`}
                        method="post"
                        action={`/workspace/document/${docId}/save-annotation`}
                        onSubmit={onSubmit}
                    >
                        <input ref={hiddenRef} type="hidden" name="annotation" />
                        <textarea
                            ref={noteRef}
                            name="note"
                            placeholder="// add note..."
                            onChange={(e) => {
                                setTweetSidenote(e.target.value);
                                e.currentTarget.style.height = "auto";
                                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 3 * 24)}px`;
                            }}
                            rows={1}
                            className="w-full resize-none overflow-y-auto bg-background/40 border-2 border-border/40 px-2 py-1.5 font-mono text-xs focus:ring-0 focus:outline-none focus:border-accent/60 leading-6 transition-colors placeholder:text-muted-foreground/60"
                            onMouseDown={(e) => e.stopPropagation()}
                        />
                    </Form>
                </div>

                <div className="flex flex-col gap-1 border-l border-border/30 pl-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 shrink-0 hover:bg-accent/20 hover:border-accent/40 transition-all"
                                    type="submit"
                                    form={`annotation-form-${docId}`}
                                >
                                    <CornerDownLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add annotation</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="h-px bg-border/30 my-1" />

                    <Form method="post" action={`/workspace/document/${docId}/chat-create`} onSubmit={handleCreateChatSubmit}>
                        <input ref={newChatHiddenRef} type="hidden" name="selection" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    type="submit"
                                    className="h-8 w-8 hover:bg-accent/20 hover:border-accent/40 transition-all"
                                >
                                    <MessageCirclePlus className="h-4 w-4" />
                                    <span className="sr-only">Create new chat</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Create new chat</p>
                            </TooltipContent>
                        </Tooltip>
                    </Form>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                    setIncludeSelection(true);
                                }}
                                className="h-8 w-8 hover:bg-accent/20 hover:border-accent/40 transition-all"
                            >
                                <MessageSquareReply className="h-4 w-4" />
                                <span className="sr-only">Add to existing chat</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Add to current chat</p>
                        </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {}}
                                className="h-8 w-8 hover:bg-accent/20 hover:border-accent/40 transition-all"
                            >
                                <Tweet title={docTitle} annotationText={tweetSidenote} selectionText={selectionText} docId={docId} theme={theme}></Tweet>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Tweet annotation</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
};
