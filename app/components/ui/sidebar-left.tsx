import { PanelLeftIcon, PanelRightIcon } from "lucide-react"

import { createSidebarComponents } from "~/components/ui/sidebar-factory"

const {
  SidebarProvider,
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
  createTrigger,
} = createSidebarComponents({
  cookieName: "sidebar_state_left",
  width: "15rem",
  widthMobile: "18rem",
  widthIcon: "3rem",
  keyboardShortcut: "b",
})

const SidebarTriggerLeft = createTrigger(PanelLeftIcon)
const SidebarTriggerRight = createTrigger(PanelRightIcon)

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
  useSidebar,
}
