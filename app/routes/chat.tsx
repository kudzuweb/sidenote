import {
  ChatInput,
  ChatInputSubmit,
  ChatInputTextArea,
} from "~/components/ui/chat-input";
import {
  ChatMessage,
  ChatMessageAvatar,
  ChatMessageContent,
} from "~/components/ui/chat-message";
import { ChatMessageArea } from "~/components/ui/chat-message-area";
import { TextDotsLoader } from "~/components/ui/loader";
import { useEffect, useState, type MutableRefObject, type Dispatch, type SetStateAction } from "react";
import { redirect, useLoaderData, useOutletContext, useSearchParams } from "react-router";
import { requireUser } from "~/server/auth.server";
import { getChat } from "~/server/chats.server";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageTool } from "~/chat/message-tool";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";


export async function loader({ request, params }: { request: Request; params: { id?: string; chatId?: string } }) {
  const userId = await requireUser(request)
  const docId = params.id
  const chatId = params.chatId
  if (!docId || !chatId) {
    throw redirect("/")
  }
  const chat = await getChat(chatId, userId, docId)
  if (!chat) {
    throw redirect("/workspace/document/" + docId)
  }
  return { chat }
}

export default function Chat() {
  const { chat } = useLoaderData<typeof loader>() as { chat: { id: string; messages: any[] } };
  const { selectionRef, setIncludeSelection: setIncludeSelectionContext } = useOutletContext<{
    selectionRef: MutableRefObject<string>;
    setIncludeSelection: Dispatch<SetStateAction<boolean>>;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { messages, sendMessage, status, stop } = useChat({
    id: chat.id,
    messages: chat.messages,
    transport: new DefaultChatTransport(),
  });
  const [message, setMessage] = useState("");
  const isLoading = status === "submitted" || status === "streaming"
  const [includeSelectionEnabled, setIncludeSelectionEnabled] = useState<boolean>(() => {
    try {
      return !!selectionRef?.current?.trim();
    } catch {
      return false;
    }
  });

  const handleSetIncludeSelection = (value: boolean) => {
    setIncludeSelectionEnabled(value);
    setIncludeSelectionContext(value);
  };

  useEffect(() => {
    const selectionParam = searchParams.get("selection");
    if (!selectionParam) return;

    try {
      const decoded = atob(selectionParam);
      if (decoded) {
        selectionRef.current = decoded;
        setIncludeSelectionEnabled(true);
        setIncludeSelectionContext(true);
      }
    } catch (error) {
      console.error("Failed to decode selection from query parameter", error);
    } finally {
      const next = new URLSearchParams(searchParams);
      next.delete("selection");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectionRef, setSearchParams, setIncludeSelectionContext]);

  const selectedText = selectionRef?.current ?? "";
  const truncatedSelection = selectedText.length > 80
    ? `${selectedText.slice(0, 40)}...${selectedText.slice(selectedText.length - 40)}`
    : selectedText;

  const handleSubmit = () => {
    if (!message.trim()) return;
    const textToSend = includeSelectionEnabled && selectedText
      ? `${selectedText}\n\n${message}`
      : message;
    sendMessage({ text: textToSend });
    setMessage("");
    handleSetIncludeSelection(false);
    if (selectionRef) selectionRef.current = "";
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      <ChatMessageArea scrollButtonAlignment="center">
        <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
          {messages.map((message) => {
            if (message.role !== "user") {
              return (
                <ChatMessage key={message.id} id={message.id}>
                  <ChatMessageAvatar />
                  {message.parts.map((part, i: number) => {
                    switch (part.type) {
                      case 'text': {
                        return (
                          <ChatMessageContent key={`${message.id}-text-${i}`} content={part.text ?? ''} />
                        )
                      }
                      case 'tool-weather': {
                        return (
                  <MessageTool
                    key={`${message.id}-${i}`}
                    part={{
                      type: part.type as string,
                      state: (part as any).state,
                      input: (part as any).input as any,
                      output: (part as any).output as any,
                      toolCallId: (part as any).toolCallId,
                      errorText: (part as any).errorText,
                    }}
                  />
                        )
                      }
                    }
                  })}
                </ChatMessage>
              );
            }
            return (
              <ChatMessage
                key={message.id}
                id={message.id}
                variant="bubble"
                type="outgoing"
              >
                {message.parts.map((part: { type: string; text?: string }, i: number) => {
                  switch (part.type) {
                    case 'text': {
                      return (
                        <ChatMessageContent key={`${message.id}-text-${i}`} content={part.text ?? ''} />
                      )
                    }
                  }
                })}
              </ChatMessage>
            );
          })}
        </div>
      </ChatMessageArea>
      <div className="px-2 py-4 max-w-2xl mx-auto w-full">
        {includeSelectionEnabled && selectedText && (
          <div className="mb-2 text-xs border rounded-md p-2 bg-muted/40 flex items-start gap-2">
            <div className="flex-1 whitespace-pre-wrap break-words">{truncatedSelection}</div>
            <Button size="icon" variant="ghost" onClick={() => handleSetIncludeSelection(false)} aria-label="Remove selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <ChatInput
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={handleSubmit}
          loading={isLoading}
          onStop={stop}
        >
          <ChatInputTextArea placeholder="Type a message..." />
          <ChatInputSubmit />
        </ChatInput>
        {isLoading && (
          <div className="mt-2 flex items-center gap-2">
            <TextDotsLoader text="Thinking" size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
