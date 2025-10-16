import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeftIcon, PanelRightIcon } from "lucide-react"
import * as React from "react"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useIsMobile } from "~/hooks/use-mobile"
import { cn } from "~/lib/utils"

const SIDEBAR_COOKIE_NAME = "sidebar_state_left"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "15rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type LeftSidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const LeftSidebarContext = React.createContext<LeftSidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(LeftSidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<LeftSidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <LeftSidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </LeftSidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col justify-between",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden text-[#e0e3ff]/90 md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className={cn(
            "relative flex h-full w-full flex-col overflow-hidden border border-[#252447]/70 bg-[#05040f]",
            "before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(rgba(46,255,247,0.08)_1px,transparent_0)] before:bg-[length:100%_3px] before:opacity-70 before:mix-blend-screen before:content-['']",
            "after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_15%_18%,rgba(255,84,108,0.32),transparent_55%),radial-gradient(circle_at_82%_12%,rgba(111,255,236,0.2),transparent_60%),linear-gradient(125deg,rgba(86,32,255,0.22)_0%,rgba(255,93,177,0.16)_45%,transparent_75%)] after:opacity-80 after:mix-blend-lighten after:content-['']",
            "shadow-[0_25px_70px_rgba(12,0,40,0.65),0_0_45px_rgba(141,45,255,0.32)]",
            "group-data-[variant=floating]:rounded-xl group-data-[variant=floating]:border-[#3a3673]/70 group-data-[variant=floating]:shadow-[0_0_60px_rgba(141,45,255,0.35)]"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTriggerLeft({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarTriggerRight({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelRightIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
}


function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-5 -translate-x-1/2 transition-all duration-300 ease-linear group-data-[side=left]:-right-5 group-data-[side=right]:left-0 sm:flex",
        "after:absolute after:inset-y-3 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:bg-[linear-gradient(180deg,rgba(121,255,242,0.65)_0%,rgba(255,84,132,0.65)_100%)] after:opacity-80 after:shadow-[0_0_18px_rgba(111,255,244,0.35)] after:transition after:duration-300 after:ease-linear",
        "before:pointer-events-none before:absolute before:inset-y-6 before:left-1/2 before:w-[6px] before:-translate-x-1/2 before:rounded-full before:bg-[radial-gradient(circle,rgba(111,255,244,0.35),transparent_60%)] before:opacity-0 before:transition before:duration-300 before:ease-linear hover:before:opacity-100",
        "hover:after:shadow-[0_0_25px_rgba(255,86,151,0.45)] hover:after:brightness-125",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-[#0c061a]/80 group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-3",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-3",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn(
        "h-9 w-full border border-[#343065]/70 bg-[#050711]/90 font-mono text-xs tracking-[0.08em] text-[#d9dcff]/80 shadow-[0_0_0_1px_rgba(111,255,244,0.12)] transition-colors placeholder:text-[#667199]/70 focus-visible:border-[#6efff4]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6efff4]/25",
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(
        "relative isolate flex flex-col gap-3 border-b border-[#2d2850]/60 bg-gradient-to-br from-[#090417]/95 via-[#060213]/90 to-[#0f0724]/95 p-4 shadow-[0_12px_30px_rgba(15,0,42,0.35)]",
        "before:pointer-events-none before:absolute before:inset-x-4 before:-bottom-px before:h-px before:bg-[linear-gradient(90deg,rgba(123,255,244,0.45)_0%,rgba(255,98,149,0.5)_50%,rgba(123,255,244,0.45)_100%)] before:content-[''] before:z-[-1]",
        className
      )}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(
        "relative isolate flex flex-col gap-3 border-t border-[#2d2850]/60 bg-gradient-to-br from-[#070314]/95 via-[#060213]/90 to-[#0b0420]/95 p-4 shadow-[0_-12px_30px_rgba(15,0,42,0.35)]",
        "before:pointer-events-none before:absolute before:inset-x-4 before:-top-px before:h-px before:bg-[linear-gradient(90deg,rgba(123,255,244,0.35)_0%,rgba(255,98,149,0.45)_50%,rgba(123,255,244,0.35)_100%)] before:content-[''] before:z-[-1]",
        className
      )}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn(
        "mx-0 my-4 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(111,255,244,0.6),rgba(255,76,132,0.55),transparent)]",
        className
      )}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "relative flex min-h-39 flex-col gap-3 overflow-auto px-4 py-4 group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        "relative isolate flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-[#2a2850]/70 bg-[#090417]/80 p-4 shadow-[0_20px_45px_rgba(8,0,25,0.35)]",
        "before:pointer-events-none before:absolute before:-top-px before:left-1/2 before:h-[1px] before:w-[60%] before:-translate-x-1/2 before:bg-[linear-gradient(90deg,rgba(129,255,237,0.45)_0%,rgba(255,82,132,0.55)_50%,rgba(129,255,237,0.45)_100%)] before:content-[''] before:z-[-1]",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-lg after:border after:border-[#73fff6]/10 after:opacity-60 after:content-[''] after:z-[-1]",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-md border border-[#343065]/70 bg-[#0b071d]/90 px-3 font-mono text-[0.65rem] uppercase tracking-[0.28em] text-[#8ffcff]/80 outline-hidden ring-offset-2 ring-[#58fff1]/40 transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "absolute top-3 right-3 flex aspect-square w-7 items-center justify-center rounded-md border border-transparent bg-[#121027]/85 p-0 text-[#8ffcff]/80 outline-hidden transition-all duration-200 ease-out hover:border-[#ff5688]/70 hover:bg-[#1c173a]/90 hover:text-white hover:shadow-[0_0_18px_rgba(111,255,244,0.35)] focus-visible:ring-2 focus-visible:ring-[#71fff6]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#070314] [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn(
        "relative z-10 w-full text-sm text-[#d5dcff]/85",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(
        "relative z-10 flex w-full min-w-0 flex-col gap-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative isolate", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-[#32305d]/70 bg-[#080617]/90 p-2 text-left text-sm font-mono tracking-[0.04em] text-[#dfe2ff]/85 outline-hidden transition-all duration-200 ease-out ring-offset-2 ring-offset-[#060312] ring-[#71fff6]/40 hover:-translate-y-[1px] hover:border-[#71fff6]/60 hover:bg-[#110a2b]/95 hover:text-white hover:shadow-[0_0_25px_rgba(121,255,242,0.25)] focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-[0] active:border-[#ff5688]/70 active:bg-[#150c32] active:text-white active:shadow-[0_0_22px_rgba(255,86,151,0.35)] disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-9 aria-disabled:pointer-events-none aria-disabled:opacity-50 before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[110%] before:bg-[linear-gradient(100deg,transparent,rgba(121,255,242,0.45),transparent)] before:opacity-0 before:transition before:duration-300 before:ease-out before:content-[''] hover:before:translate-x-0 hover:before:opacity-100 data-[active=true]:border-[#ff5688]/70 data-[active=true]:bg-[linear-gradient(135deg,rgba(255,89,137,0.35),rgba(110,0,255,0.4))] data-[active=true]:text-white data-[active=true]:shadow-[0_0_28px_rgba(146,54,255,0.45)] data-[state=open]:border-[#71fff6]/60 data-[state=open]:text-white group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "border-[#4a4586]/75 bg-transparent shadow-[0_0_0_1px_rgba(113,255,246,0.2)] hover:bg-[#0f0a22]/95 hover:shadow-[0_0_20px_rgba(113,255,246,0.2)]",
      },
      size: {
        default: "h-10 text-sm",
        sm: "h-9 px-2.5 py-2 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "absolute top-1.5 right-1 flex aspect-square w-6 items-center justify-center rounded-md border border-transparent bg-[#121027]/80 p-0 font-mono text-xs uppercase text-[#8ffcff]/80 outline-hidden transition-all duration-200 ease-out hover:border-[#ff5688]/70 hover:bg-[#1c173a]/90 hover:text-white hover:shadow-[0_0_18px_rgba(111,255,244,0.35)] focus-visible:ring-2 focus-visible:ring-[#71fff6]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[#070314] [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
        "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-2 flex h-5 min-w-6 items-center justify-center rounded-full border border-[#ff5688]/50 bg-[#150c32]/85 px-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-[#ff9ad9] shadow-[0_0_14px_rgba(255,86,151,0.35)]",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg border border-[#2c2855]/70 bg-[#0b0516]/80 px-3",
        className
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-5 rounded-md bg-[#1b1435]"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-3.5 max-w-(--skeleton-width) flex-1 rounded bg-[#1b1435]"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "relative z-10 mx-3.5 flex min-w-0 translate-x-px flex-col gap-2 border-l border-dashed border-[#3a3570]/70 px-3 py-1",
        "before:pointer-events-none before:absolute before:-left-[1.5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[linear-gradient(180deg,rgba(121,255,242,0.45)_0%,rgba(255,84,132,0.45)_100%)] before:content-['']",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative isolate", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "relative flex h-8 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md border border-transparent bg-transparent px-2.5 text-[0.7rem] font-mono tracking-[0.08em] text-[#bfc3ff]/85 outline-hidden transition-all duration-200 ease-out hover:border-[#71fff6]/60 hover:bg-[#120c2b]/85 hover:text-white hover:shadow-[0_0_16px_rgba(121,255,242,0.2)] focus-visible:ring-2 focus-visible:ring-[#71fff6]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[#070314] active:border-[#ff5688]/70 active:bg-[#150c32] active:text-white disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-[#8ffcff]/80",
        "before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[110%] before:bg-[linear-gradient(100deg,transparent,rgba(121,255,242,0.35),transparent)] before:opacity-0 before:transition before:duration-300 before:ease-out before:content-[''] hover:before:translate-x-0 hover:before:opacity-100",
        "data-[active=true]:border-[#ff5688]/70 data-[active=true]:bg-[linear-gradient(135deg,rgba(255,89,137,0.3),rgba(110,0,255,0.35))] data-[active=true]:text-white data-[active=true]:shadow-[0_0_24px_rgba(146,54,255,0.35)]",
        size === "sm" && "h-7 px-2 text-[0.6rem]",
        size === "md" && "h-8 text-[0.7rem]",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTriggerLeft,
  SidebarTriggerRight,
  useSidebar
}
