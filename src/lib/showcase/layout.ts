// Geometry of the mock desktop. The picture is drawn on a fixed 1280x800 canvas and scaled to fit,
// so the script can aim the cursor at exact points on any screen size.

export const CANVAS = { width: 1280, height: 800 } as const;

/** The mock browser window on the canvas. */
export const WINDOW = { left: 40, top: 28, width: 1200, height: 700, tabs: 40, bar: 44 } as const;

/** The page area inside the browser window, in canvas coordinates. */
export const VIEWPORT = {
  left: WINDOW.left,
  top: WINDOW.top + WINDOW.tabs + WINDOW.bar,
  width: WINDOW.width,
  height: WINDOW.height - WINDOW.tabs - WINDOW.bar,
} as const;

/** The (fictional) store the walkthrough shops at. */
export const STORE = { name: "Greenfield Market", domain: "greenfield.example", address: "14 Orchard Lane, Bristol" } as const;

export const PRODUCTS = [
  { name: "Whole Milk", size: "2 litres", price: 1.35, unit: "68p / litre", emoji: "🥛", tint: "from-sky-100 to-sky-200" },
  { name: "Sliced Wholemeal Bread", size: "800g", price: 1.1, unit: "14p / 100g", emoji: "🍞", tint: "from-amber-100 to-amber-200" },
  { name: "Free Range Eggs", size: "12 pack", price: 2.6, unit: "22p / egg", emoji: "🥚", tint: "from-orange-100 to-orange-200" },
  { name: "Bananas", size: "5 pack", price: 0.95, unit: "19p / each", emoji: "🍌", tint: "from-yellow-100 to-yellow-200" },
  { name: "Chicken Breast", size: "500g", price: 5.4, unit: "£10.80 / kg", emoji: "🍗", tint: "from-rose-100 to-rose-200" },
  { name: "Basmati Rice", size: "1kg", price: 2.2, unit: "£2.20 / kg", emoji: "🍚", tint: "from-stone-100 to-stone-200" },
  { name: "Greek Yoghurt", size: "500g", price: 1.8, unit: "36p / 100g", emoji: "🥣", tint: "from-indigo-100 to-indigo-200" },
  { name: "Gala Apples", size: "6 pack", price: 2.1, unit: "35p / each", emoji: "🍎", tint: "from-red-100 to-red-200" },
] as const;

export const DELIVERY_FEE = 2.5;
export const ORDER_NUMBER = "GM-48213";
export const DELIVERY_SLOT = "Tomorrow, 9am to 11am";

export const TILE = { width: 190, height: 200, gap: 14, left: 24, top: 190, columns: 4 } as const;

/** Top-left corner of a product tile, relative to the page area. */
export function tilePosition(index: number) {
  return {
    x: TILE.left + (index % TILE.columns) * (TILE.width + TILE.gap),
    y: TILE.top + Math.floor(index / TILE.columns) * (TILE.height + TILE.gap),
  };
}

export type Rect = { x: number; y: number; width: number; height: number };

/** Page-area coordinates to canvas coordinates. */
const onCanvas = (x: number, y: number) => ({ x: VIEWPORT.left + x, y: VIEWPORT.top + y });

const centreOf = (rect: Rect, origin = { x: 0, y: 0 }) =>
  onCanvas(origin.x + rect.x + rect.width / 2, origin.y + rect.y + rect.height / 2);

// Every clickable thing, positioned in page-area coordinates. The drawing and the cursor's
// targets both come from here, so the cursor always lands on what it is meant to press.
export const SEARCH_BOX: Rect = { x: 250, y: 42, width: 520, height: 40 };
/** Relative to its product tile. */
export const ADD_BUTTON: Rect = { x: 12, y: TILE.height - 46, width: TILE.width - 24, height: 34 };
export const BASKET: Rect = { x: 860, y: 136, width: 316, height: 460 };
/** Relative to the basket. */
export const CHECKOUT_BUTTON: Rect = { x: 16, y: BASKET.height - 60, width: BASKET.width - 32, height: 44 };
export const EMAIL_FIELD: Rect = { x: 64, y: 340, width: 552, height: 44 };
export const PASSWORD_FIELD: Rect = { x: 64, y: 396, width: 552, height: 44 };
export const PLACE_ORDER_BUTTON: Rect = { x: 64, y: 456, width: 552, height: 44 };
export const REFILL_BUTTON: Rect = { x: 108, y: 436, width: 584, height: 48 };

/** Where the cursor goes to press a product's "Add" button. */
export function addButtonSpot(index: number) {
  return centreOf(ADD_BUTTON, tilePosition(index));
}

// Fixed points the cursor visits, in canvas coordinates.
export const SPOTS = {
  search: centreOf(SEARCH_BOX),
  checkout: centreOf(CHECKOUT_BUTTON, BASKET),
  password: centreOf(PASSWORD_FIELD),
  placeOrder: centreOf(PLACE_ORDER_BUTTON),
  requestRefill: centreOf(REFILL_BUTTON),
  idle: onCanvas(620, 300),
} as const;

const cents = (price: number) => Math.round(price * 100);

/** Total of the first `count` products, in pounds. */
export function basketTotal(count: number) {
  return PRODUCTS.slice(0, count).reduce((sum, product) => sum + cents(product.price), 0) / 100;
}

/** What is charged: the items plus delivery. */
export const orderTotal = (count: number) => (cents(basketTotal(count)) + cents(DELIVERY_FEE)) / 100;

export const formatPrice = (pounds: number) => `£${pounds.toFixed(2)}`;

/** How a price reads aloud: 17.5 -> "17 pounds 50". */
export function spokenPrice(pounds: number) {
  const whole = Math.floor(pounds);
  const pence = Math.round((pounds - whole) * 100);
  return pence ? `${whole} pounds ${pence}` : `${whole} pounds`;
}

/** How an order number reads aloud, character by character: "GM-48213" -> "G M 4 8 2 1 3". */
export const spokenOrderNumber = (orderNumber: string) => orderNumber.replace("-", "").split("").join(" ");
