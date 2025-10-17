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
import DocumentList from "./document/DocumentList";
import GroupList from "./group/GroupList";
import { GroupModal } from "./group/GroupModal";
import SearchResultList from "./SearchResultList";
import { Accordion } from "./ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import UploadForm from "./upload-form";
import Logo from "./logo";

type UIMessagePart = { type: string; text?: string }
type UIMessage = { role: string; parts: UIMessagePart[] }
type UserInfo = { name: string; email: string; avatar: string; fallback: string }
type SidebarAppProps = { setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" >>; theme: "light" | "dark"; data: any; user: UserInfo; side: "left" | "right" } & ComponentProps<typeof Sidebar>

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
        <Tabs defaultValue="tab-1" className="items-center">
          <div className="flex w-full items-center justify-between">
            <Button size="icon" variant="ghost" onClick={() => {
              setGroupId(null)
              setDocumentId(null)
            }}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
            <TabsList>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TabsTrigger value="tab-1" className="py-3" onClick={() => {
                      setMode("document")
                      setGroupId(null)
                      setDocumentId(null)
                    }}>
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
                    <TabsTrigger value="tab-2" className="group py-3" onClick={() => {
                      setMode("group")
                      setGroupId(null)
                      setDocumentId(null)
                    }}>
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
                <Button size="icon" variant="ghost" onClick={() => {
                  setEditingGroup(null);
                  setIsModalOpen(true);
                }}>
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
              <span className="text-md font-semibold">Reads</span>
            </div>
          </TabsContent>
          <TabsContent value="tab-2">
            <div className="flex items-center gap-2">
              <span className="text-md font-semibold">Groups</span>
            </div>
          </TabsContent>
        </Tabs>
      </SidebarHeader>
      <SidebarContent>
        <fetcher.Form method="get" action="/workspace/document-search" onSubmit={handleSearchSubmit}>
          <div className="flex items-center justify-between">
            <input className="text-xs py-2 pl-4 pr-2" type="text" name="query" placeholder="Search" value={query} onChange={(e) => { setQuery(e.target.value) }} />
            {searchResults.length > 0 ?
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => {
                      setSearchResults([])
                      setMode("group")
                      setQuery("")
                    }}>
                      <SearchX className="h-5 w-5" />
                      <span className="sr-only">Clear Search</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clear Search</p>
                  </TooltipContent>
                </Tooltip>
              </>
              :
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" type="submit">
                      <Search className="h-5 w-5" />
                      <span className="sr-only">Search</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search</p>
                  </TooltipContent>
                </Tooltip>
              </>
            }
          </div>
        </fetcher.Form>
        <Form method="post" action="document-create" onSubmit={handleNewDocSubmit} autoComplete="off">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <input className="text-xs py-2 pl-4 pr-2" type="text" name="url" value={url} onInput={handleUrlInput} disabled={documentLimitReached} placeholder="Add Read by URL" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" type="submit" disabled={documentLimitReached}>
                    <FilePlus2 className="h-5 w-5" />
                    <span className="sr-only">Add Read</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add Read</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="crawl" />
                Crawl site
              </label>
              <input className="text-xs py-1 px-2 w-20" type="number" name="maxPages" min={1} max={200} placeholder="25" />
              <select name="splitMode" className="text-xs py-1 px-2">
                <option value="aggregate">One document</option>
                <option value="split">One per page</option>
              </select>
            </div>
          </div>
        </Form>
        <UploadForm disabled={documentLimitReached} />
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
      </SidebarContent>
      <SidebarContent>
        <div className="flex flex-col gap-4">
          <SidebarGroup>
            {searchResults.length > 0 ?
              <>
                <SidebarGroupLabel>Search Results</SidebarGroupLabel>
                <SidebarMenu>
                  <SearchResultList results={searchResults} />
                </SidebarMenu>
              </>
              :
              mode === "document" ?
                <>
                  <SidebarGroupLabel>Recent</SidebarGroupLabel>
                  <SidebarMenu>
                    <DocumentList documents={documents} />
                  </SidebarMenu>
                </>
                : mode === "group" &&
                <>
                  <SidebarGroupLabel>Recent</SidebarGroupLabel>
                  <SidebarMenu>
                    <Accordion type="single" collapsible className="w-full" defaultValue="3">
                      <GroupList groups={groups} onEditGroup={handleEditGroup} />
                    </Accordion>
                  </SidebarMenu>
                </>
            }
          </SidebarGroup>
        </div>
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter className="mt-auto">
        <NavUser user={user} setTheme={setTheme} theme={theme} />
      </SidebarFooter>
    </Sidebar>
  );
}
