"use client";

import { ArrowLeft, CreditCard, FilePlus2, Library, Loader2, Search, SearchX, Sparkles, UserPlus, Users } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { Form, useFetcher, useRevalidator, useLocation } from "react-router";
import { NavUser } from "~/components/nav-user";
import { Button } from "~/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarSeparator
} from "~/components/ui/sidebar-left";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  iconButtonClasses,
  inputShellClasses,
  secondaryPanelClasses,
  sectionTitleClasses,
  tabTriggerClasses,
} from "~/components/ui/sidebar-theme";
import { cn } from "~/lib/utils";
import DocumentList from "./document/DocumentList";
import GroupList from "./group/GroupList";
import { GroupModal } from "./group/GroupModal";
import SearchResultList from "./SearchResultList";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import UploadForm from "./upload-form";
import Logo from "./logo";

type UIMessagePart = { type: string; text?: string }
type UIMessage = { role: string; parts: UIMessagePart[] }
type UserInfo = { name: string; email: string; avatar: string; fallback: string }
type SidebarAppProps = { setTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>; theme: "light" | "dark"; data: any; user: UserInfo; side: "left" | "right" } & ComponentProps<typeof Sidebar>

export function SidebarApp({ side, setTheme, theme, data, user, ...props }: SidebarAppProps) {
  const [mode, setMode] = useState("document")
  const [groupId, setGroupId] = useState(null)
  const [documentId, setDocumentId] = useState(null)
  const [url, setUrl] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [query, setQuery] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const location = useLocation();
  const [editingGroup, setEditingGroup] = useState(null);
  const [groups, setGroups] = useState(data.groups)
  const [documents, setDocuments] = useState(data.documents)
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const handleEditGroup = (group: any) => {
    setEditingGroup(group);
    setIsModalOpen(true);
  }

  const handleGroupSuccess = () => {
    revalidator.revalidate();
  }

  useEffect(() => {
    if (data?.document) setDocumentId(data.document.id)
    if (data?.documents) setDocuments(data.documents)
    if (data?.groups) setGroups(data.groups)
  }, [data])

  const limitInfo = data?.documentLimit;
  const documentLimitReached = limitInfo ? !limitInfo.allowed : false;
  const documentsRemaining = limitInfo?.remaining === Infinity ? null : limitInfo?.remaining;
  const isSubscribed = limitInfo?.subscribed ?? false;

  useEffect(() => {
    if (fetcher.data && fetcher.data.length > 0) {
      setSearchResults(fetcher.data);
      setMode("search")
    } else if (fetcher.state === 'idle' && fetcher.data?.length === 0) {
      setSearchResults([]);
      //  setMode("group")
    }
  }, [fetcher.data, fetcher.state]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget as HTMLFormElement
    const input = form.querySelector('input[name="query"]') as HTMLInputElement
    const value = input?.value || "";

    if (!value.trim()) {
      event.preventDefault() // Prevent submission if empty
      return
    }
  }

  const handleUrlInput = (event: React.FormEvent<HTMLInputElement>) => {
    setUrl(event.currentTarget.value)
  }

  const handleNewDocSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // event.preventDefault()
    if (documentLimitReached) {
      event.preventDefault()
      return
    }
    const form = event.currentTarget as HTMLFormElement

    const input = form.querySelector('input[name="url"]') as HTMLInputElement
    const value = input?.value || ""
    if (!value.trim()) {
      event.preventDefault()
      return
    }
    if (input) input.value = value.trim()
  }

  const hasSearchResults = searchResults.length > 0
  const isGroupMode = mode === "group"
  const sidebarListLabel = hasSearchResults
    ? "Signal Scan"
    : isGroupMode
      ? "Collective Nodes"
      : "Recent Transmission"

  const sidebarListBody = hasSearchResults ? (
    <SearchResultList results={searchResults} />
  ) : isGroupMode ? (
    <Accordion type="single" collapsible className="w-full">
      <GroupList groups={groups} onEditGroup={handleEditGroup} />
    </Accordion>
  ) : (
    <DocumentList documents={documents} />
  )

  const startBillingRequest = async (intent: "checkout" | "portal") => {
    setBillingError(null)
    setBillingLoading(true)
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start billing")
      }

      if (payload.alreadySubscribed) {
        setBillingError("Your subscription is already active.")
        return
      }

      if (payload?.url) {
        window.location.href = payload.url
        return
      }

      throw new Error("Billing response missing redirect URL.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Billing request failed"
      setBillingError(message)
    } finally {
      setBillingLoading(false)
    }
  }

  const handleUpgrade = () => startBillingRequest("checkout")
  const handleManageBilling = () => startBillingRequest("portal")

  return (
    <Sidebar className="border-r-0" {...props} side="left">
      <SidebarHeader>
        <Logo theme={theme} />
        {new URLSearchParams(location.search).get("message") && (
          <div className="mt-2 text-xs p-2 rounded bg-amber-100 text-amber-900">
            {new URLSearchParams(location.search).get("message")}
          </div>
        )}
        <Tabs defaultValue="tab-1" className="items-center gap-4 text-[#d9dcff]/80">
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              size="icon"
              variant="ghost"
              className={iconButtonClasses}
              onClick={() => {
                setGroupId(null)
                setDocumentId(null)
              }}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            <TabsList className="flex items-center gap-2 rounded-xl border border-[#2a2850]/70 bg-[#090417]/80 p-1 shadow-[0_12px_30px_rgba(8,0,25,0.35)]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TabsTrigger
                      value="tab-1"
                      className={tabTriggerClasses}
                      onClick={() => {
                        setMode("document")
                        setGroupId(null)
                        setDocumentId(null)
                      }}
                    >
                      <Library size={16} aria-hidden="true" />
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">
                  Reads
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TabsTrigger
                      value="tab-2"
                      className={cn(tabTriggerClasses, "group")}
                      onClick={() => {
                        setMode("group")
                        setGroupId(null)
                        setDocumentId(null)
                      }}
                    >
                      <span className="relative">
                        <Users size={16} aria-hidden="true" />
                      </span>
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="px-2 py-1 text-xs">
                  Groups
                </TooltipContent>
              </Tooltip>
            </TabsList>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  size="icon"
                  variant="ghost"
                  className={iconButtonClasses}
                  onClick={() => {
                    setEditingGroup(null);
                    setIsModalOpen(true);
                  }}
                >
                  <UserPlus className="h-5 w-5" />
                  <span className="sr-only">Create New Group</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                New Group
              </TooltipContent>
            </Tooltip>
            <GroupModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              onSuccess={handleGroupSuccess}
              editGroup={editingGroup}
            />
          </div>
          <TabsContent value="tab-1">
            <div className="flex items-center gap-2">
              <span className={sectionTitleClasses}>Reads Circuit</span>
            </div>
          </TabsContent>
          <TabsContent value="tab-2">
            <div className="flex items-center gap-2">
              <span className={sectionTitleClasses}>Collective Mesh</span>
            </div>
          </TabsContent>
        </Tabs>
      </SidebarHeader>
      <SidebarContent className="flex-1">
        <div className="flex h-full flex-col gap-4 px-3 py-4">
          <div className="space-y-3">
            <fetcher.Form
              method="get"
              action="/workspace/document-search"
              className="space-y-3"
              onSubmit={handleSearchSubmit}
            >
              <div className={cn(secondaryPanelClasses, "flex w-full items-center gap-2")}>
                <input
                  className={cn(inputShellClasses, "flex-1 min-w-0")}
                  type="text"
                  name="query"
                  placeholder="Search Signal"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                  }}
                />
                {hasSearchResults ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(iconButtonClasses, "shrink-0")}
                        onClick={() => {
                          setSearchResults([])
                          setMode("group")
                          setQuery("")
                        }}
                      >
                        <SearchX className="h-5 w-5" />
                        <span className="sr-only">Clear Search</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear Search</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        type="submit"
                        disabled={documentLimitReached}
                        className={cn(iconButtonClasses, "shrink-0")}
                      >
                        <Search className="h-5 w-5" />
                        <span className="sr-only">Search</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Search</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </fetcher.Form>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="document-intake" className="w-full">
                <AccordionTrigger className="w-full rounded-xl border border-[#26224a]/70 bg-[#0b0618]/80 px-3 py-2 text-[0.7rem] font-mono uppercase tracking-[0.18em] text-[#8ffcff]/80 hover:text-white">
                  <span className="flex items-center gap-2">
                    <FilePlus2 className="h-4 w-4 shrink-0 text-[#71fff6]" />
                    Document Intake
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <Form
                    method="post"
                    action="document-create"
                    onSubmit={handleNewDocSubmit}
                    autoComplete="off"
                    className="space-y-3"
                  >
                    <div className={cn(secondaryPanelClasses, "grid w-full gap-3")}>
                      <div className="flex items-center gap-2">
                        <input
                          className={cn(inputShellClasses, "flex-1 min-w-0")}
                          type="text"
                          name="url"
                          value={url}
                          onInput={handleUrlInput}
                          placeholder="Beam in via URL"
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              type="submit"
                              className={cn(iconButtonClasses, "shrink-0")}
                            >
                              <FilePlus2 className="h-5 w-5" />
                              <span className="sr-only">Add Read</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Add Read</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="grid gap-2 text-[#8ffcff]/70">
                        <label className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.12em]">
                          <input
                            type="checkbox"
                            name="crawl"
                            className="size-4 rounded border border-[#343065]/70 bg-[#050711]/90 accent-[#ff5688] focus:outline-none focus:ring-2 focus:ring-[#6efff4]/30"
                          />
                          Crawl site
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            className={cn(inputShellClasses, "w-full text-center")}
                            type="number"
                            name="maxPages"
                            min={1}
                            max={200}
                            placeholder="25"
                          />
                          <select
                            name="splitMode"
                            className={cn(inputShellClasses, "w-full bg-[#050711]/90 text-xs")}
                          >
                            <option value="aggregate">One document</option>
                            <option value="split">One per page</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </Form>
                  <div className="w-full">
                    <UploadForm disabled={documentLimitReached} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          {limitInfo && (
            <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-2 text-xs">
              {!isSubscribed ? (
                <>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold text-muted-foreground">
                      {documentLimitReached
                        ? `Free plan limit reached (${limitInfo.limit} documents).`
                        : `Free plan: ${documentsRemaining ?? limitInfo.limit
                        } document${documentsRemaining === 1 ? "" : "s"} remaining.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={handleUpgrade}
                      disabled={billingLoading}
                    >
                      {billingLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting…
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Upgrade to Pro
                        </>
                      )}
                    </Button>
                    <p className="text-muted-foreground">
                      Unlimited documents plus priority support.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold text-muted-foreground">Pro plan active</p>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={billingLoading}
                  >
                    {billingLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Opening portal…
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Manage Billing
                      </>
                    )}
                  </Button>
                </div>
              )}
              {billingError && <p className="text-destructive">{billingError}</p>}
            </div>
          )}
          <SidebarSeparator />
          <div className="flex-1">
            <SidebarGroup className="flex h-full flex-col">
              <SidebarGroupLabel>{sidebarListLabel}</SidebarGroupLabel>
              <ScrollArea className="mt-2 flex-1 pr-1">
                <SidebarMenu className="w-full">
                  {sidebarListBody}
                </SidebarMenu>
              </ScrollArea>
            </SidebarGroup>
          </div>
        </div>
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="mt-auto">
        <NavUser user={user} setTheme={setTheme} theme={theme} />
      </SidebarFooter>
    </Sidebar>
  );
}
