"use client";

import { Check, ChevronLeft, ChevronRight, Lock, MapPin, Minus, Plus, RotateCw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ADD_BUTTON,
  BASKET,
  basketTotal,
  CANVAS,
  CHECKOUT_BUTTON,
  DELIVERY_FEE,
  DELIVERY_SLOT,
  EMAIL_FIELD,
  formatPrice,
  ORDER_NUMBER,
  orderTotal,
  PASSWORD_FIELD,
  PLACE_ORDER_BUTTON,
  PRODUCTS,
  REFILL_BUTTON,
  SEARCH_BOX,
  STORE,
  TILE,
  tilePosition,
  VIEWPORT,
  WINDOW,
  type Rect,
} from "@/lib/showcase/layout";
import type { DesktopPage, DesktopState } from "@/lib/showcase/types";
import { cn } from "@/lib/utils";

const TABS: Record<DesktopPage, { title: string; url: string }> = {
  blank: { title: "New Tab", url: "" },
  store: { title: `${STORE.name} | Online grocery delivery`, url: `${STORE.domain}/shop/usual` },
  checkout: { title: `Checkout | ${STORE.name}`, url: `${STORE.domain}/checkout` },
  confirmation: { title: `Order confirmed | ${STORE.name}`, url: `${STORE.domain}/orders/${ORDER_NUMBER}` },
  pharmacy: { title: "Repeat prescriptions | CityCare Pharmacy", url: "citycare.example/my-prescriptions" },
};

/** Absolute placement from a layout rectangle, so the picture matches where the cursor aims. */
const place = ({ x, y, width, height }: Rect) => ({ position: "absolute" as const, left: x, top: y, width, height });

const GREEN = "bg-emerald-600";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex size-9 items-center justify-center rounded-full text-lg text-white", GREEN)}>🌿</span>
      <span className="text-xl font-extrabold tracking-tight text-emerald-800">
        Greenfield <span className="font-semibold text-slate-700">Market</span>
      </span>
    </div>
  );
}

function StorePage({ state }: { state: DesktopState }) {
  const items = PRODUCTS.slice(0, state.basket);
  const subtotal = basketTotal(state.basket);

  return (
    <div className="absolute inset-0 bg-white text-slate-900">
      <div className="flex h-8 items-center justify-between bg-slate-900 px-6 text-[13px] text-slate-300">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" /> Delivering to <b className="text-white">{STORE.address}</b> · {DELIVERY_SLOT}
        </span>
        <span>Help · Store finder · Offers</span>
      </div>
      <div className="flex h-[60px] items-center justify-between border-b border-slate-200 px-6">
        <Logo />
        <div className="flex items-center gap-5 text-sm font-medium text-slate-700">
          <span>My account</span>
          <span className={cn("rounded-full px-4 py-2 text-white", GREEN)}>
            Basket · {formatPrice(subtotal)}
          </span>
        </div>
      </div>
      <div
        className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-4 text-[15px] text-slate-700"
        style={place(SEARCH_BOX)}
      >
        <Search className="size-4 text-slate-400" />
        {state.search || <span className="text-slate-400">Search products and offers</span>}
      </div>

      <nav className="absolute inset-x-0 top-[92px] flex h-8 items-center gap-2 px-6 text-[13px] font-medium">
        {["Your usual", "Fruit & veg", "Dairy & eggs", "Bakery", "Meat & fish", "Cupboard"].map((name, index) => (
          <span
            key={name}
            className={cn("rounded-full px-3 py-1", index === 0 ? "bg-emerald-100 text-emerald-800" : "text-slate-600")}
          >
            {name}
          </span>
        ))}
      </nav>
      <div className="absolute top-[132px] left-6">
        <h2 className="text-2xl font-bold">Your usual shop</h2>
        <p className="text-sm text-slate-500">The {PRODUCTS.length} things you buy most weeks</p>
      </div>

      {PRODUCTS.map((product, index) => {
        const position = tilePosition(index);
        const added = index < state.basket;
        return (
          <div
            key={product.name}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={place({ x: position.x, y: position.y, width: TILE.width, height: TILE.height })}
          >
            <div className={cn("relative flex h-[88px] items-center justify-center bg-gradient-to-br text-5xl", product.tint)}>
              {product.emoji}
              <span className="absolute top-2 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 uppercase">
                Usual
              </span>
            </div>
            <div className="px-3 pt-2">
              <p className="truncate text-[14px] leading-5 font-semibold">{product.name}</p>
              <p className="text-xs text-slate-500">{product.size}</p>
              <p className="mt-0.5 text-[15px] font-bold">
                {formatPrice(product.price)} <span className="text-[11px] font-normal text-slate-400">{product.unit}</span>
              </p>
            </div>
            <div
              className={cn(
                "flex items-center justify-center gap-2 rounded-full text-sm font-semibold",
                added ? "border-2 border-emerald-600 bg-white text-emerald-700" : cn("text-white", GREEN),
              )}
              style={place(ADD_BUTTON)}
            >
              {added ? (
                <>
                  <Minus className="size-4" /> 1 in basket <Plus className="size-4" />
                </>
              ) : (
                <>
                  <Plus className="size-4" /> Add
                </>
              )}
            </div>
          </div>
        );
      })}

      <aside className="rounded-xl border border-slate-200 bg-white shadow-sm" style={place(BASKET)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-lg font-bold">Your basket</p>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">
            {state.basket} {state.basket === 1 ? "item" : "items"}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">Your basket is empty. Add your usual items to get started.</p>
        ) : (
          <ul className="grid gap-1 px-4 py-3 text-[13px] text-slate-700">
            {items.map((item) => (
              <li key={item.name} className="flex justify-between gap-2">
                <span className="truncate">
                  {item.emoji} {item.name} <span className="text-slate-400">{item.size}</span>
                </span>
                <span className="font-medium">{formatPrice(item.price)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="absolute inset-x-4 bottom-[76px] grid gap-1 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <span>{formatPrice(DELIVERY_FEE)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatPrice(subtotal + DELIVERY_FEE)}</span>
          </div>
        </div>
        <div
          className={cn("flex items-center justify-center rounded-full font-semibold text-white", GREEN)}
          style={place(CHECKOUT_BUTTON)}
        >
          Go to checkout
        </div>
      </aside>
    </div>
  );
}

function Card({ title, rect, children }: { title: string; rect: Rect; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" style={place(rect)}>
      <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function CheckoutPage({ state }: { state: DesktopState }) {
  const count = PRODUCTS.length;
  const subtotal = basketTotal(count);

  return (
    <div className="absolute inset-0 bg-slate-50 text-slate-900">
      <div className="flex h-14 items-center border-b border-slate-200 bg-white px-6">
        <Logo />
        <span className="ml-auto flex items-center gap-1.5 text-sm text-slate-500">
          <Lock className="size-4" /> Secure checkout
        </span>
      </div>
      <h2 className="absolute top-[68px] left-16 text-2xl font-bold">Checkout</h2>

      <Card title="Delivery" rect={{ x: 64, y: 104, width: 552, height: 92 }}>
        <p className="mt-1 text-[15px] font-medium">{STORE.address}</p>
        <p className="text-sm text-slate-500">{DELIVERY_SLOT}</p>
      </Card>
      <Card title="Payment" rect={{ x: 64, y: 206, width: 552, height: 72 }}>
        <p className="mt-1 flex items-center gap-2 text-[15px] font-medium">
          <span className="rounded bg-blue-700 px-1.5 py-0.5 text-[10px] font-bold text-white">VISA</span> Card ending 4242
        </p>
      </Card>

      <p className="absolute left-16 text-lg font-bold" style={{ top: EMAIL_FIELD.y - 40 }}>
        Sign in to pay
      </p>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white px-4 text-slate-500" style={place(EMAIL_FIELD)}>
        you@example.com
      </div>
      <div
        className={cn(
          "flex items-center rounded-lg border bg-white px-4 text-2xl tracking-widest text-slate-800",
          state.handover ? "border-violet-500 ring-4 ring-violet-400/50" : "border-slate-300",
        )}
        style={place(PASSWORD_FIELD)}
      >
        {state.password > 0 ? "•".repeat(state.password) : <span className="text-base tracking-normal text-slate-400">Password</span>}
      </div>
      <div className={cn("flex items-center justify-center rounded-full font-semibold text-white", GREEN)} style={place(PLACE_ORDER_BUTTON)}>
        Sign in &amp; pay {formatPrice(orderTotal(count))}
      </div>
      {state.handover && (
        <div
          className="absolute flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          style={{ left: 380, top: EMAIL_FIELD.y - 46 }}
        >
          <span className="size-2 animate-pulse rounded-full bg-white" /> Your turn: sign in here
        </div>
      )}

      <aside className="rounded-xl border border-slate-200 bg-white p-5" style={place({ x: 664, y: 104, width: 480, height: 372 })}>
        <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">Order summary</h3>
        <ul className="mt-3 grid gap-1.5 text-sm text-slate-700">
          {PRODUCTS.map((item) => (
            <li key={item.name} className="flex justify-between">
              <span>
                {item.emoji} {item.name}
              </span>
              <span>{formatPrice(item.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <span>{formatPrice(DELIVERY_FEE)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(orderTotal(count))}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

const TRACKING = ["Order placed", "Being picked", "On its way", "Delivered"];

function ConfirmationPage() {
  return (
    <div className="absolute inset-0 bg-slate-50 text-slate-900">
      <div className="flex h-14 items-center border-b border-slate-200 bg-white px-6">
        <Logo />
      </div>
      <div className="mx-auto mt-10 flex w-[640px] flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <span className={cn("flex size-16 items-center justify-center rounded-full text-white", GREEN)}>
          <Check className="size-8" />
        </span>
        <h2 className="text-3xl font-bold">Thanks, your order is confirmed</h2>
        <p className="text-slate-500">
          Order <b className="text-slate-800">{ORDER_NUMBER}</b> · {PRODUCTS.length} items · {formatPrice(orderTotal(PRODUCTS.length))}
        </p>
        <p className="text-lg font-semibold text-emerald-700">Arriving {DELIVERY_SLOT.toLowerCase()}</p>
        <ol className="mt-6 flex w-full items-start justify-between">
          {TRACKING.map((step, index) => (
            <li key={step} className="flex flex-1 flex-col items-center gap-2 text-xs font-medium">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-white",
                  index === 0 ? GREEN : "bg-slate-300",
                )}
              >
                {index === 0 ? <Check className="size-4" /> : index + 1}
              </span>
              <span className={index === 0 ? "text-slate-800" : "text-slate-400"}>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function PharmacyPage({ state }: { state: DesktopState }) {
  return (
    <div className="absolute inset-0 bg-sky-50 text-slate-900">
      <div className="flex h-14 items-center justify-between bg-sky-800 px-6 text-white">
        <span className="text-xl font-bold">✚ CityCare Pharmacy</span>
        <span className="text-sm text-sky-100">My prescriptions · Find a pharmacy · Help</span>
      </div>
      <h2 className="absolute top-[72px] left-[84px] text-2xl font-bold">Repeat prescriptions</h2>

      <section className="rounded-xl border border-slate-200 bg-white" style={place({ x: 84, y: 120, width: 632, height: 380 })}>
        <p className="border-b px-5 py-3 text-sm font-semibold text-slate-500">Choose what you need</p>
        {["Atorvastatin 20mg tablets · 28", "Amlodipine 5mg tablets · 28"].map((medicine) => (
          <label key={medicine} className="flex items-center gap-3 border-b px-5 py-3 text-[15px]">
            <span className="flex size-5 items-center justify-center rounded bg-sky-600 text-white">
              <Check className="size-3.5" />
            </span>
            {medicine}
          </label>
        ))}
        <div className="px-5 py-3 text-[15px]">
          <p className="text-sm font-semibold text-slate-500">Collect from</p>
          <p className="mt-1 rounded-lg border border-slate-300 px-3 py-2">CityCare Pharmacy · 22 High Street</p>
        </div>
      </section>
      <aside className="rounded-xl border border-slate-200 bg-white p-5" style={place({ x: 744, y: 120, width: 400, height: 200 })}>
        <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">How it works</h3>
        <ol className="mt-3 grid gap-2 text-sm text-slate-700">
          <li>1. Choose the medicines you need</li>
          <li>2. Pick where to collect them</li>
          <li>3. We&apos;ll have them ready in 2 working days</li>
        </ol>
        <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">Open Mon to Sat, 9am to 6pm</p>
      </aside>
      {state.refillRequested && (
        <p
          className="absolute flex items-center rounded-lg bg-emerald-100 px-4 font-medium text-emerald-800"
          style={{ left: 108, top: 388, width: 584, height: 36 }}
        >
          ✓ Refill requested · Ready Thursday after 12:00
        </p>
      )}
      <div
        className={cn(
          "flex items-center justify-center rounded-full text-lg font-semibold text-white",
          state.refillRequested ? "bg-slate-400" : "bg-sky-700",
        )}
        style={place(REFILL_BUTTON)}
      >
        {state.refillRequested ? "Requested ✓" : "Request refill"}
      </div>
    </div>
  );
}

function NewTabPage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-white">
      <span className="text-5xl font-semibold tracking-tight text-slate-300">Search</span>
      <div className="flex w-[520px] items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-slate-400">
        <Search className="size-4" /> Search or type a URL
      </div>
      <div className="flex gap-6">
        {["🛒", "💊", "⚡", "✉️"].map((icon) => (
          <span key={icon} className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            {icon}
          </span>
        ))}
      </div>
    </div>
  );
}

function Cursor({ state }: { state: DesktopState }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-20 transition-[left,top] duration-500 ease-in-out"
      style={{ left: state.cursor.x, top: state.cursor.y }}
    >
      {state.clicks > 0 && (
        <span key={state.clicks} className="animate-click-ripple absolute -top-4 -left-4 size-8 rounded-full bg-violet-400/60" />
      )}
      <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-md">
        <path d="M5 3l14 8-6 1.5L10 19 5 3z" fill="#fff" stroke="#14121c" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** A picture of the assistant's desktop, standing in for the live one. Drawn at 1280x800 and scaled to fit. */
export function MockDesktop({ state }: { state: DesktopState }) {
  const frame = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 0.5, left: 0, top: 0 });
  const tab = TABS[state.page];

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    // The observer reports the size straight away and again whenever it changes.
    const observer = new ResizeObserver(() => {
      const scale = Math.min(element.clientWidth / CANVAS.width, element.clientHeight / CANVAS.height);
      setFit({
        scale,
        left: (element.clientWidth - CANVAS.width * scale) / 2,
        top: (element.clientHeight - CANVAS.height * scale) / 2,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} role="img" aria-label="The assistant's desktop" className="relative size-full overflow-hidden bg-[#14121c]">
      <div
        className="absolute origin-top-left overflow-hidden font-sans"
        style={{
          width: CANVAS.width,
          height: CANVAS.height,
          left: fit.left,
          top: fit.top,
          transform: `scale(${fit.scale})`,
          backgroundImage: "radial-gradient(58% 55% at 50% 46%, rgba(74,53,176,.55), rgba(20,18,28,1) 72%)",
        }}
      >
        <div
          className="absolute overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-black/30"
          style={place({ x: WINDOW.left, y: WINDOW.top, width: WINDOW.width, height: WINDOW.height })}
        >
          <div className="flex items-end bg-[#14121c] px-3" style={{ height: WINDOW.tabs }}>
            <div className="flex h-9 w-72 items-center rounded-t-lg bg-[#1c1a27] px-4 text-sm text-[#ece9f5]">
              <span className="truncate">{tab.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-[#1c1a27] px-4" style={{ height: WINDOW.bar }}>
            <ChevronLeft className="size-5 text-[#a39fb5]" />
            <ChevronRight className="size-5 text-[#5d5972]" />
            <RotateCw className="size-4 text-[#a39fb5]" />
            <div className="flex h-8 flex-1 items-center gap-2 rounded-full bg-[#262336] px-4 text-sm text-[#ece9f5]">
              {tab.url ? <Lock className="size-3.5 text-[#a39fb5]" /> : <Search className="size-3.5 text-[#a39fb5]" />}
              {tab.url || <span className="text-[#a39fb5]">Search or type a URL</span>}
            </div>
          </div>
          <div className="relative overflow-hidden" style={{ height: VIEWPORT.height }}>
            {state.page === "blank" && <NewTabPage />}
            {state.page === "store" && <StorePage state={state} />}
            {state.page === "checkout" && <CheckoutPage state={state} />}
            {state.page === "confirmation" && <ConfirmationPage />}
            {state.page === "pharmacy" && <PharmacyPage state={state} />}
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-[#322e45] bg-[#1c1a27] px-4"
          style={{ height: 60 }}
        >
          <span className="size-9 rounded-lg" style={{ background: "conic-gradient(#ea4335, #fbbc05, #34a853, #4285f4, #ea4335)" }} />
          <span className="flex size-9 items-center justify-center rounded-lg bg-amber-400/90 text-lg">📁</span>
          <span className="flex size-9 items-center justify-center rounded-lg bg-black font-mono text-sm text-green-400">&gt;_</span>
          <span className="ml-3 max-w-72 truncate rounded-lg border border-violet-400 bg-[#2b2745] px-4 py-1.5 text-sm text-[#ece9f5]">
            {tab.title}
          </span>
          <span className="ml-auto text-right text-sm leading-tight text-[#ece9f5]">
            <span className="block font-semibold">09:41</span>
            <span className="block text-xs text-[#a39fb5]">Sat 24 Oct</span>
          </span>
        </div>

        <Cursor state={state} />
      </div>
    </div>
  );
}
