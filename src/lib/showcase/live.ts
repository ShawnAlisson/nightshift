import "server-only";
import { ActionError } from "@/lib/computer/actions";
import { QUIET_CHROME_FLAGS, type Desktop } from "@/lib/computer/desktop";
import type { LiveStep } from "@/lib/showcase/live-steps";

/**
 * The real-website part of the walkthrough: a fixed sequence of actions on the live desktop, with
 * no AI involved. Each step is named, and only these names can be run (the route checks), so
 * nothing here ever takes input from the browser.
 *
 * Points are screen coordinates read off real screenshots of each page at 1280x800 with Chrome
 * maximised. They only need to hold for parts of the pages that are the same on every visit.
 */
const SITE = "https://www.ubereats.com";
// A well-known public place, so the demo never shows anyone's home.
const ADDRESS = "Times Square, New York";

const POINTS = {
  cookiesAccept: [1202, 706],
  addressField: [290, 453],
  firstSuggestion: [148, 520],
  groceryCategory: [243, 350],
  logIn: [1103, 119],
} as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (desktop: Desktop, [x, y]: readonly [number, number]) => desktop.clickSmoothly(x, y);

/** Every step checks that it worked. A step that fails stops the run, so it never clicks blindly. */
function expect(worked: boolean, problem: string) {
  if (!worked) throw new ActionError(problem);
}

const STEPS: Record<LiveStep, (desktop: Desktop) => Promise<void>> = {
  // Done while the opening scene plays: proves the browser works before the live scene begins.
  async prepare(desktop) {
    await desktop.ensureBrowser();
  },
  // A fresh private window every time, so no earlier visit (a basket, a login) can get in the way.
  async open(desktop) {
    await desktop.restartBrowser([...QUIET_CHROME_FLAGS, "--incognito", SITE]);
    expect(await desktop.waitForTitle("Uber Eats", 35_000), "Uber Eats didn't open");
    await desktop.settle(15_000);
  },
  async "accept-cookies"(desktop) {
    await click(desktop, POINTS.cookiesAccept);
    await sleep(700);
  },
  async "enter-address"(desktop) {
    await click(desktop, POINTS.addressField);
    await sleep(400);
    await desktop.perform({ name: "type", input: { text: ADDRESS } });
    await desktop.settle(8_000); // suggestions load as you type
  },
  async "pick-address"(desktop) {
    const before = await desktop.windowTitle();
    await click(desktop, POINTS.firstSuggestion);
    // Choosing an address moves from the home page to the restaurant feed, which changes the title.
    expect(await desktop.waitForTitleChange(before, 35_000), "The address wasn't accepted");
    await sleep(2_500);
    await desktop.settle(30_000, 3); // the feed loads slowly
  },
  async grocery(desktop) {
    await click(desktop, POINTS.groceryCategory);
    // The store list is the best shot of the whole run. It shows grey loading boxes first (about 0.015
    // colourful, measured) and the real colourful list (about 0.067) after a variable wait.
    await sleep(2_000);
    expect(await desktop.waitForColour(0.04, 35_000), "The stores didn't load");
    await sleep(800);
  },
  async login(desktop) {
    await click(desktop, POINTS.logIn);
    await sleep(800);
    expect(await desktop.waitForTitle("Log in", 20_000), "The sign-in page didn't open");
    await desktop.settle(4_000);
  },
  // Back to a normal browser, so nobody is left in a private window on someone else's sign-in page.
  async cleanup(desktop) {
    await desktop.restartBrowser([...QUIET_CHROME_FLAGS, "about:blank"]);
  },
};

export const runLiveStep = (desktop: Desktop, step: LiveStep) => STEPS[step](desktop);
