"use client";

import { Check, Loader2, MessageSquare, Pencil, Search, SquarePen, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { deleteConversation, renameConversation, searchConversations } from "@/actions/conversations";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ConversationSummary } from "@/lib/conversations";
import { showcaseStore } from "@/lib/showcase/store";
import { MAX_SEARCH_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validations/assistant";

const SEARCH_DEBOUNCE_MS = 200;
// A hidden command: typing exactly this into the box starts the guided walkthrough.
const WALKTHROUGH_COMMAND = "/demo";
const isWalkthroughCommand = (text: string) => text.trim().toLowerCase() === WALKTHROUGH_COMMAND;

// The keyboard hint depends on the platform, which the server can't know: empty there, real in the browser.
const subscribeNever = () => () => {};
const platformShortcut = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K");

/** Cmd/Ctrl+K: find, open, rename and delete conversations. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Results remember which query produced them, so "loading" is simply a mismatch.
  const [results, setResults] = useState<{ query: string; items: ConversationSummary[] }>();
  const [renaming, setRenaming] = useState<string>();
  const [deleting, setDeleting] = useState<string>();
  const [error, setError] = useState<string>();
  const shortcut = useSyncExternalStore(subscribeNever, platformShortcut, () => "");

  const changeOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setRenaming(undefined);
      setDeleting(undefined);
      setError(undefined);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeOpen(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, changeOpen]);

  useEffect(() => {
    // The command is not a search, so don't send it to the server.
    if (!open || isWalkthroughCommand(query)) return;
    let stale = false;
    const timer = setTimeout(
      async () => {
        try {
          const items = await searchConversations(query);
          if (!stale) setResults({ query, items });
        } catch {
          if (!stale) setError("Couldn't load conversations");
        }
      },
      query ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  /** Closes the box and starts the walkthrough on a fresh chat. */
  function startWalkthrough() {
    changeOpen(false);
    showcaseStore.request();
    if (window.location.pathname !== "/assistant") router.push("/assistant");
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (isWalkthroughCommand(value)) startWalkthrough();
  }

  function go(href: string) {
    changeOpen(false);
    router.push(href);
  }

  const items = results?.items ?? [];
  const loading = !error && results?.query !== query;

  function patchItems(update: (items: ConversationSummary[]) => ConversationSummary[]) {
    setResults((current) => current && { ...current, items: update(current.items) });
  }

  async function rename(id: string, title: string) {
    const result = await renameConversation(id, title);
    if ("error" in result) return setError(result.error);
    setError(undefined);
    setRenaming(undefined);
    patchItems((list) => list.map((item) => (item.id === id ? { ...item, title: result.title } : item)));
  }

  async function remove(id: string) {
    const { ok } = await deleteConversation(id);
    if (!ok) return setError("Couldn't delete that conversation");
    setError(undefined);
    setDeleting(undefined);
    patchItems((list) => list.filter((item) => item.id !== id));
    // Deleting the chat you're looking at would leave a dead page.
    if (window.location.pathname === `/assistant/${id}`) router.push("/assistant");
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => changeOpen(true)}
        aria-label="Search conversations"
        className="text-muted-foreground sm:w-56 sm:justify-start"
      >
        <Search />
        <span className="max-sm:sr-only">Search chats</span>
        {shortcut && (
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-sans text-[10px] font-medium sm:block">
            {shortcut}
          </kbd>
        )}
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={changeOpen}
        title="Search conversations"
        description="Search, open, rename or delete your conversations."
      >
        {/* Results are filtered on the server, so cmdk's own filtering is off. */}
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={onQueryChange}
            maxLength={MAX_SEARCH_LENGTH}
            placeholder="Search conversations…"
          />
          <CommandList className="max-h-80">
            {!query && (
              <CommandGroup>
                <CommandItem value="new-chat" onSelect={() => go("/assistant")}>
                  <SquarePen />
                  New chat
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading={query ? "Results" : "Recent"}>
              {items.map((item) =>
                deleting === item.id ? (
                  <ConfirmRow key={item.id} title={item.title} onConfirm={() => remove(item.id)} onCancel={() => setDeleting(undefined)} />
                ) : renaming === item.id ? (
                  <RenameRow key={item.id} title={item.title} onSave={(title) => rename(item.id, title)} onCancel={() => setRenaming(undefined)} />
                ) : (
                  <CommandItem key={item.id} value={item.id} onSelect={() => go(`/assistant/${item.id}`)} className="group/row">
                    <MessageSquare className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="flex gap-0.5 opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 group-data-[selected=true]/row:opacity-100 max-sm:opacity-100">
                      <RowButton label={`Rename ${item.title}`} onClick={() => setRenaming(item.id)}>
                        <Pencil />
                      </RowButton>
                      <RowButton label={`Delete ${item.title}`} onClick={() => setDeleting(item.id)}>
                        <Trash2 />
                      </RowButton>
                    </span>
                  </CommandItem>
                ),
              )}
            </CommandGroup>

            {loading && (
              <div className="flex justify-center py-4 text-muted-foreground" role="status" aria-label="Searching">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loading && items.length === 0 && <CommandEmpty>No conversations found.</CommandEmpty>}
          </CommandList>
          {error && (
            <p role="alert" className="border-t px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </Command>
      </CommandDialog>
    </>
  );
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      className="text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        // Don't also open the conversation.
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function RenameRow({ title, onSave, onCancel }: { title: string; onSave: (title: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.select(), []);

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
      <input
        ref={inputRef}
        value={value}
        maxLength={MAX_TITLE_LENGTH}
        aria-label="Conversation title"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Keep keys away from the list's own keyboard handling.
          event.stopPropagation();
          if (event.key === "Enter" && !event.nativeEvent.isComposing) onSave(value);
          if (event.key === "Escape") onCancel();
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <RowButton label="Save title" onClick={() => onSave(value)}>
        <Check />
      </RowButton>
      <RowButton label="Cancel rename" onClick={onCancel}>
        <X />
      </RowButton>
    </div>
  );
}

function ConfirmRow({ title, onConfirm, onCancel }: { title: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-label={`Delete ${title}?`} className="flex items-center gap-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate">Delete “{title}”?</span>
      <Button type="button" size="xs" variant="destructive" onClick={onConfirm}>
        Delete
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
