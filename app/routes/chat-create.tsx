import { redirect, type ActionFunctionArgs } from "react-router"
import { requireUser } from "~/server/auth.server"
import { saveChat } from "~/server/chats.server"

// POST /chat will create a new chat
export async function action({ request, params }: ActionFunctionArgs) {
  const docId = params.id
  const userId = await requireUser(request)

  const formData = await request.formData()
  const selectionRaw = formData.get("selection")
  let selectionQuery = ""
  if (typeof selectionRaw === "string" && selectionRaw.trim().length > 0) {
    const encodedSelection = Buffer.from(selectionRaw, "utf-8").toString("base64")
    selectionQuery = `?selection=${encodeURIComponent(encodedSelection)}`
  }
  const chat = {
    id: crypto.randomUUID(),
    userId: userId,
    documentId: docId,
    messages: []
  }
  await saveChat(chat)
  // Redirect to the newly created chat route
  throw redirect(`/workspace/document/${docId}/chat/${chat.id}${selectionQuery}`)
}
