import React from "react";
import { Channel, OrderStatusMaster } from "../types";

export interface PresetColor {
  name: string;
  hex: string;
}

export const PRESET_COLORS: PresetColor[] = [
  { name: "Emerald", hex: "#10B981" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Fuchsia", hex: "#D946EF" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Red", hex: "#EF4444" },
  { name: "Orange", hex: "#F97316" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Lime", hex: "#84CC16" },
  { name: "Green", hex: "#22C55E" },
  { name: "Slate", hex: "#64748B" },
  { name: "Zinc", hex: "#3F3F46" },
  { name: "Dark", hex: "#18181B" },
];

export const DEFAULT_CHANNEL_COLORS: Record<string, string> = {
  tokopedia: "#10B981",
  shopee: "#F97316",
  tiktok: "#18181B",
  "tiktok shop": "#18181B",
  lazada: "#6366F1",
  offline: "#64748B",
  "offline store": "#64748B",
  whatsapp: "#25D366",
  instagram: "#E1306C",
  b2b: "#0284C7",
};

export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  "input orderan": "#F59E0B",
  diproses: "#3B82F6",
  "selesai packing": "#10B981",
  batal: "#EF4444",
  retur: "#8B5CF6",
};

/**
 * Converts Hex string to rgba string
 */
export function hexToRgba(hex: string, alpha = 1): string {
  if (!hex || typeof hex !== "string") return `rgba(100, 116, 139, ${alpha})`;
  let cleanHex = hex.trim().replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleanHex.length !== 6) return `rgba(100, 116, 139, ${alpha})`;
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return `rgba(100, 116, 139, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Deterministically picks a color from preset list if not found
 */
export function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PRESET_COLORS.length;
  return PRESET_COLORS[index].hex;
}

/**
 * Resolves color for a given channel name using Master Data channels
 */
export function getChannelColor(channelName: string, channels?: Channel[]): string {
  if (!channelName) return "#64748B";
  const trimmed = channelName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check Master Data list
  if (channels && channels.length > 0) {
    const found = channels.find(
      (c) => c.nama_channel?.trim().toLowerCase() === lower
    );
    if (found?.color && found.color.startsWith("#")) {
      return found.color;
    }
  }

  // 2. Fallback to default channel palette
  if (DEFAULT_CHANNEL_COLORS[lower]) {
    return DEFAULT_CHANNEL_COLORS[lower];
  }

  // 3. Fallback deterministic hash
  return hashStringToColor(trimmed);
}

/**
 * Resolves color for a given order status using Master Data order_status
 */
export function getStatusColor(
  statusName: string,
  statuses?: OrderStatusMaster[]
): string {
  if (!statusName) return "#64748B";
  const trimmed = statusName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check Master Data list
  if (statuses && statuses.length > 0) {
    const found = statuses.find(
      (s) => s.nama_status?.trim().toLowerCase() === lower
    );
    if (found?.color && found.color.startsWith("#")) {
      return found.color;
    }
  }

  // 2. Fallback to default status palette
  if (DEFAULT_STATUS_COLORS[lower]) {
    return DEFAULT_STATUS_COLORS[lower];
  }

  // 3. Fallback deterministic hash
  return hashStringToColor(trimmed);
}

/**
 * Returns dynamic CSS style for badges based on hex color
 */
export function getDynamicBadgeStyle(hexColor: string): React.CSSProperties {
  const isVeryDark =
    hexColor.toLowerCase() === "#09090b" ||
    hexColor.toLowerCase() === "#18181b" ||
    hexColor.toLowerCase() === "#000000";

  return {
    backgroundColor: hexToRgba(hexColor, isVeryDark ? 0.08 : 0.12),
    color: isVeryDark ? "#18181B" : hexColor,
    borderColor: hexToRgba(hexColor, isVeryDark ? 0.3 : 0.35),
  };
}
