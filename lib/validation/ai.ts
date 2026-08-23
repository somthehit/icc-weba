// lib/validation/ai.ts
//
// Request shapes for the Gemini proxy routes.
//
// These endpoints are public — the storefront assistant answers guests — so
// every field they forward to a billed API is bounded here. Without a cap on
// prompt length, history size and inline image bytes, a public POST is an open
// tap on the shop's Gemini quota that the per-IP rate limit only slows down.

import { z } from 'zod';

/** The only models the proxy will spend the key on. */
export const AI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
] as const;

export const AI_ROLES = [
  'store_specialist',
  'pc_architect',
  'repair_cctv_tech',
  'local_guide',
] as const;

const MAX_PROMPT = 4_000;
const MAX_HISTORY_TURNS = 30;

const chatMessage = z.object({
  sender: z.string().trim().max(20),
  text: z.string().max(MAX_PROMPT),
});

const latLng = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const chatRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'Ask a question first').max(MAX_PROMPT),
  chatHistory: z.array(chatMessage).max(MAX_HISTORY_TURNS).default([]),
  model: z.enum(AI_MODELS).default('gemini-3.5-flash'),
  role: z.enum(AI_ROLES).default('store_specialist'),
  enableMapsGrounding: z.boolean().default(false),
  userLocation: latLng.optional(),
});

export const assistantRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'Ask a question first').max(MAX_PROMPT),
  chatHistory: z.array(chatMessage).max(MAX_HISTORY_TURNS).default([]),
  // This used to be forwarded verbatim, so a caller could name any model at all
  // — including ones far more expensive than the assistant needs.
  model: z.enum(AI_MODELS).default('gemini-3.5-flash'),
});

export const mapsRequestSchema = z.object({
  query: z.string().trim().max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).default(27.700769),
  longitude: z.coerce.number().min(-180).max(180).default(85.31295),
});

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9', '1:4', '1:8', '4:1', '8:1'] as const;
const IMAGE_SIZES = ['512px', '1K', '2K'] as const;
const STYLE_PRESETS = [
  'hardware_studio',
  'cyberpunk_rgb',
  'minimalist_desk',
  'blueprint_schematic',
] as const;

/** ~4 MB of base64, i.e. roughly a 3 MB source image. */
const MAX_BASE_IMAGE_CHARS = 4_000_000;

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(1, 'A descriptive text prompt is required.').max(MAX_PROMPT),
  baseImage: z.string().max(MAX_BASE_IMAGE_CHARS, 'Image is too large — keep it under 3 MB').optional(),
  mimeType: z.enum(IMAGE_MIME_TYPES).default('image/png'),
  aspectRatio: z.enum(ASPECT_RATIOS).default('1:1'),
  imageSize: z.enum(IMAGE_SIZES).default('1K'),
  stylePreset: z.enum(STYLE_PRESETS).optional(),
});
