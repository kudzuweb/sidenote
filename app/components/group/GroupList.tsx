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
        (group: { id: string, name?: string | null }) => {
          const name = (group.name && group.name.trim().length > 0)
            ? group.name
            : (group.id)
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <AccordionItem value={group.id} key={group.id} className="w-full">
                  <AccordionTrigger className="w-full">
                    <SidebarMenuButton className="flex w-full items-start gap-2 px-2 py-2 text-xs">
                      <div className="flex w-full min-w-0 flex-col gap-2">
                        <div className="flex-1 overflow-hidden">
                          <span className="line-clamp-2 leading-snug break-words text-left overflow-hidden text-ellipsis whitespace-normal">
                            {name}
                          </span>
                        </div>
                        <div className="flex w-full flex-row items-center justify-between">
                          <GroupAvatarStack users={group?.members} />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="mt-[2px] flex h-5 w-5 shrink-0 p-0"
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
                            <Pencil className="mr-2 h-4 w-4 shrink-0 mt-[2px]" />
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
