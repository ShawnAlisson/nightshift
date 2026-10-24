import { DesktopProvider } from "@/components/assistant/desktop-provider";
import { AppHeader } from "@/components/layout/app-header";

// The shell is exactly one viewport tall; the chat scrolls inside <main>.
export default function AssistantLayout({ children }: LayoutProps<"/assistant">) {
  return (
    <DesktopProvider>
      <div className="flex h-dvh flex-col">
        <AppHeader />
        <main id="main" className="flex min-h-0 w-full flex-1 flex-col px-4 pb-4">
          {children}
        </main>
      </div>
    </DesktopProvider>
  );
}
