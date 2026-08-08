import {
  Bookmark,
  Car,
  Clapperboard,
  Dumbbell,
  Home,
  Lightbulb,
  Plane,
  ShoppingBag,
  Shirt,
  Sparkles,
  Star,
  Ticket,
  UtensilsCrossed,
  ChefHat,
  type LucideIcon,
} from "lucide-react";

/**
 * Categories are a *display* convenience only. The database stores whatever
 * category the analyser produced, so unknown values still render gracefully.
 */
export type CategoryMeta = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** tailwind classes using semantic tokens only */
  tone: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { key: "travel", label: "Travel", icon: Plane, tone: "text-chart-2" },
  { key: "restaurants", label: "Restaurants", icon: UtensilsCrossed, tone: "text-chart-4" },
  { key: "shopping", label: "Shopping", icon: ShoppingBag, tone: "text-chart-1" },
  { key: "recipes", label: "Recipes", icon: ChefHat, tone: "text-chart-3" },
  { key: "events", label: "Events", icon: Ticket, tone: "text-chart-4" },
  { key: "entertainment", label: "Entertainment", icon: Clapperboard, tone: "text-chart-1" },
  { key: "fitness", label: "Fitness", icon: Dumbbell, tone: "text-success" },
  { key: "fashion", label: "Fashion", icon: Shirt, tone: "text-chart-4" },
  { key: "cars", label: "Cars", icon: Car, tone: "text-chart-2" },
  { key: "home", label: "Home", icon: Home, tone: "text-chart-3" },
  { key: "ideas", label: "Ideas", icon: Lightbulb, tone: "text-chart-3" },
  { key: "important", label: "Important", icon: Star, tone: "text-destructive" },
  { key: "other", label: "Other", icon: Bookmark, tone: "text-muted-foreground" },
];

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(category?: string | null): CategoryMeta {
  if (!category) return { key: "other", label: "Unsorted", icon: Sparkles, tone: "text-muted-foreground" };
  const found = BY_KEY.get(category.toLowerCase().trim());
  if (found) return found;
  return {
    key: category.toLowerCase(),
    label: category.charAt(0).toUpperCase() + category.slice(1),
    icon: Bookmark,
    tone: "text-muted-foreground",
  };
}

export const SOURCE_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  safari: "Safari",
  chrome: "Chrome",
  "google maps": "Google Maps",
  googlemaps: "Google Maps",
  booking: "Booking.com",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  x: "X",
  twitter: "X",
  pinterest: "Pinterest",
  airbnb: "Airbnb",
  reddit: "Reddit",
  imessage: "Messages",
  messages: "Messages",
};

export function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  const key = source.toLowerCase().trim();
  if (!key || key === "unknown") return null;
  return SOURCE_LABELS[key] ?? source;
}

export function formatPrice(price?: number | string | null, currency?: string | null) {
  if (price === null || price === undefined || price === "") return null;
  const value = typeof price === "string" ? Number(price) : price;
  if (Number.isNaN(value)) return null;
  const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NOK: "kr ", SEK: "kr " };
  const symbol = currency ? (symbols[currency.toUpperCase()] ?? `${currency.toUpperCase()} `) : "";
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
