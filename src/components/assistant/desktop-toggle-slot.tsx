import { connection } from "next/server";
import { Suspense } from "react";
import { DesktopToggle } from "@/components/assistant/desktop-toggle";
import { isComputerUseEnabled } from "@/lib/computer/config";

/** Shows the toggle only when computer use is on. The env is read per request, so the rest of the header stays static. */
export function DesktopToggleSlot() {
  return (
    <Suspense fallback={null}>
      <EnabledToggle />
    </Suspense>
  );
}

async function EnabledToggle() {
  await connection();
  return isComputerUseEnabled() ? <DesktopToggle /> : null;
}
