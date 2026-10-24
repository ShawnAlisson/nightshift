import Link from "next/link";
import { deleteConversation } from "@/actions/conversations";
import { Button } from "@/components/ui/button";
import { listConversations } from "@/lib/conversations";

export async function ConversationList() {
  const conversations = await listConversations();

  if (conversations.length === 0) {
    return <p className="px-2 text-sm text-muted-foreground">No conversations yet.</p>;
  }

  return (
    <ul className="grid gap-1">
      {conversations.map(({ id, title }) => (
        <li key={id} className="group flex items-center gap-1 rounded-md hover:bg-muted">
          <Link href={`/dashboard/assistant/${id}`} className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm">
            {title}
          </Link>
          <form action={deleteConversation}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="ghost" size="xs" aria-label={`Delete ${title}`}>
              ✕
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
