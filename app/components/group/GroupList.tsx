import { Pencil } from "lucide-react"
import DocumentList from "../document/DocumentList"
import GroupAvatarStack from "../groupavatar"
import { AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"
import { Button } from "../ui/button"
import { SidebarMenuButton } from "../ui/sidebar-left"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"



const GroupList = (props: { groups, onEditGroup }) => {
  // console.log("GROUP:", props.groups[0].documents)
  return (
    <>
      {props?.groups?.map(
        (group: { id: string, name?: string | null, members?: any[], documents?: any[] }) => {
          const name = (group.name && group.name.trim().length > 0)
            ? group.name
            : (group.id)
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <AccordionItem value={group.id} key={group.id} className="w-full">
                  <AccordionTrigger className="w-full [&>button]:w-full">
                    <SidebarMenuButton className="w-full px-2 py-3 h-auto">
                      <div className="flex w-full flex-col gap-3">
                        <div className="w-full text-left">
                          <span className="line-clamp-2 leading-snug break-words whitespace-normal text-xs">
                            {name}
                          </span>
                        </div>
                        <div className="flex w-full flex-row items-center gap-2">
                          {group?.members && group.members.length > 0 && (
                            <div className="flex-shrink-0">
                              <GroupAvatarStack users={group.members} />
                            </div>
                          )}
                          <div className="flex-1" />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onEditGroup({
                                id: group.id,
                                name: name,
                                members: group.members || [],
                                documents: group.documents || []
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </SidebarMenuButton>
                  </AccordionTrigger>
                  <AccordionContent className="w-full pb-2">
                    <DocumentList documents={group.documents} />
                  </AccordionContent>
                </AccordionItem>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="max-w-xs">
                <p>{name}</p>
              </TooltipContent>
            </Tooltip>
          )
        })
      }
    </>
  )
}

export default GroupList 
