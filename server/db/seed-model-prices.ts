// seed-model-prices.ts
// BUNU kv.ts'NİN İÇİNE YAPIŞTIRMA.
// kv.ts adapter kalsın.
// Bu dosyayı projene ayrı ekle ve fiyatları KV'ye seed et.

import { kv } from "./kv";
import { calculateSaleCredits } from '../services/pricingService.js';

export type BillingType = "tokens" | "image";

export type ModelPrice = {
  serviceType: string;
  provider: string;
  modelName: string;
  modelId: string;
  billingType: BillingType;
  inputUsdPer1M?: number;
  outputUsdPer1M?: number;
  usdPerImage?: number;
  sourceUrl: string;
};

export const MODEL_PRICES_KEY = "pricing:catalog:v1";
export const USD_TRY_RATE_KEY = "pricing:fx:usd_try";
export const MODEL_PRICE_PREFIX = "pricing:model:";

export const MODEL_PRICES: ModelPrice[] = [
  {
    serviceType: "LLM / chat",
    provider: "OpenAI",
    modelName: "GPT-5.4",
    modelId: "openai/gpt-5.4",
    billingType: "tokens",
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "OpenAI",
    modelName: "GPT-5.4 Pro",
    modelId: "openai/gpt-5.4-pro",
    billingType: "tokens",
    inputUsdPer1M: 30,
    outputUsdPer1M: 180,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Inception",
    modelName: "Mercury 2",
    modelId: "inception/mercury-2",
    billingType: "tokens",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 0.75,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "OpenAI",
    modelName: "GPT-5.3 Chat",
    modelId: "openai/gpt-5.3-chat",
    billingType: "tokens",
    inputUsdPer1M: 1.75,
    outputUsdPer1M: 14,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Lite Preview",
    modelId: "google/gemini-3.1-flash-lite-preview",
    billingType: "tokens",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Image",
    modelId: "google/gemini-3.1-flash-image-preview",
    billingType: "image",
    usdPerImage: 0.067,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / coding",
    provider: "OpenAI",
    modelName: "GPT-5.2 Codex Mini",
    modelId: "openai/gpt-5.2-codex-mini",
    billingType: "tokens",
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o3",
    modelId: "openai/o3",
    billingType: "tokens",
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o4-mini",
    modelId: "openai/o4-mini",
    billingType: "tokens",
    inputUsdPer1M: 1.1,
    outputUsdPer1M: 4.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Qwen",
    modelName: "Qwen3-VL-235B-A22B",
    modelId: "qwen/qwen3-vl-235b-a22b",
    billingType: "tokens",
    inputUsdPer1M: 0.13,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Qwen",
    modelName: "Qwen3.5-Flash",
    modelId: "qwen/qwen3.5-flash-02-23",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Liquid AI",
    modelName: "LFM2-24B-A2B",
    modelId: "liquid/lfm-2-24b-a2b",
    billingType: "tokens",
    inputUsdPer1M: 0.03,
    outputUsdPer1M: 0.12,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Liquid AI",
    modelName: "LFM2-40B",
    modelId: "liquid/lfm-2-40b",
    billingType: "tokens",
    inputUsdPer1M: 0.08,
    outputUsdPer1M: 0.24,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "xAI",
    modelName: "Grok 4 Fast Reasoning",
    modelId: "x-ai/grok-4-fast-reasoning",
    billingType: "tokens",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 0.5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "xAI",
    modelName: "Grok 4 Fast Non-Reasoning",
    modelId: "x-ai/grok-4-fast-non-reasoning",
    billingType: "tokens",
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 0.5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 3.1 Flash",
    modelId: "google/gemini-3.1-flash",
    billingType: "tokens",
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Native Audio",
    modelId: "google/gemini-3.1-flash-native-audio",
    billingType: "tokens",
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 2,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Google",
    modelName: "Gemma 3 27B",
    modelId: "google/gemma-3-27b-it",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "DeepSeek",
    modelName: "DeepSeek R1 0528",
    modelId: "deepseek/deepseek-r1-0528",
    billingType: "tokens",
    inputUsdPer1M: 0.55,
    outputUsdPer1M: 2.19,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / coding",
    provider: "DeepSeek",
    modelName: "DeepSeek V3.1",
    modelId: "deepseek/deepseek-chat-v3.1",
    billingType: "tokens",
    inputUsdPer1M: 0.27,
    outputUsdPer1M: 1.1,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-4.1 Nano",
    modelId: "openai/gpt-4.1-nano",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-5 Nano",
    modelId: "openai/gpt-5-nano",
    billingType: "tokens",
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Image Preview",
    modelId: "google/gemini-3.1-flash-image-preview",
    billingType: "tokens",
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 30,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "MoonshotAI",
    modelName: "Kimi K2 Instruct",
    modelId: "moonshotai/kimi-k2-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.57,
    outputUsdPer1M: 2.3,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 3.1 Pro",
    modelId: "google/gemini-3.1-pro",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Audio model",
    provider: "PlayAI",
    modelName: "Dialog 1.0",
    modelId: "playai/dialog-1.0",
    billingType: "tokens",
    inputUsdPer1M: 20,
    outputUsdPer1M: 80,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / coding",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Preview",
    modelId: "google/gemini-3.1-flash-preview",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Search / answer",
    provider: "Perplexity",
    modelName: "Sonar",
    modelId: "perplexity/sonar",
    billingType: "tokens",
    inputUsdPer1M: 1,
    outputUsdPer1M: 1,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Search / deep research",
    provider: "Perplexity",
    modelName: "Sonar Deep Research",
    modelId: "perplexity/sonar-deep-research",
    billingType: "tokens",
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / coding",
    provider: "Google",
    modelName: "Gemini 3.1 Flash Lite",
    modelId: "google/gemini-3.1-flash-lite",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Anthropic",
    modelName: "Claude Sonnet 4.0",
    modelId: "anthropic/claude-sonnet-4",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Anthropic",
    modelName: "Claude Opus 4.1",
    modelId: "anthropic/claude-opus-4.1",
    billingType: "tokens",
    inputUsdPer1M: 15,
    outputUsdPer1M: 75,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux 1.1 Pro",
    modelId: "black-forest-labs/flux-1.1-pro",
    billingType: "image",
    usdPerImage: 0.04,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux 1.1 Pro Ultra",
    modelId: "black-forest-labs/flux-1.1-pro-ultra",
    billingType: "image",
    usdPerImage: 0.06,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux Kontext Max",
    modelId: "black-forest-labs/flux-kontext-max",
    billingType: "image",
    usdPerImage: 0.08,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux Kontext Pro",
    modelId: "black-forest-labs/flux-kontext-pro",
    billingType: "image",
    usdPerImage: 0.04,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Code search",
    provider: "CodeRabbit",
    modelName: "CodeRabbit Code Search",
    modelId: "coderabbitai/coderabbit-code-search",
    billingType: "tokens",
    inputUsdPer1M: 0.5,
    outputUsdPer1M: 0.5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "Google",
    modelName: "Gemini 2.5 Pro",
    modelId: "google/gemini-2.5-pro",
    billingType: "tokens",
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Mistral Medium 3.1",
    modelId: "mistralai/mistral-medium-3.1-2506",
    billingType: "tokens",
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 2,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Devstral Small 1.1",
    modelId: "mistralai/devstral-small-2507",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.3,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Mistral NeMo 12B Instruct",
    modelId: "mistralai/mistral-nemo",
    billingType: "tokens",
    inputUsdPer1M: 0.03,
    outputUsdPer1M: 0.15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Mistral Small 3.2",
    modelId: "mistralai/mistral-small-3.2-24b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.06,
    outputUsdPer1M: 0.18,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Pixtral Large 1.1",
    modelId: "mistralai/pixtral-large-2411",
    billingType: "tokens",
    inputUsdPer1M: 2,
    outputUsdPer1M: 6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Search / answer",
    provider: "Exa",
    modelName: "Exa AI Search",
    modelId: "exa/exa-ai-search",
    billingType: "tokens",
    inputUsdPer1M: 5,
    outputUsdPer1M: 5,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / agentic",
    provider: "Cerebras",
    modelName: "Qwen 3 235B",
    modelId: "cerebras/qwen-3-235b-a22b-instruct-2507",
    billingType: "tokens",
    inputUsdPer1M: 0.6,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Meta",
    modelName: "Llama 3.1 8B Instruct",
    modelId: "meta-llama/llama-3.1-8b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.02,
    outputUsdPer1M: 0.08,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Meta",
    modelName: "Llama 3.1 70B Instruct",
    modelId: "meta-llama/llama-3.1-70b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.12,
    outputUsdPer1M: 0.3,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Meta",
    modelName: "Llama 4 Maverick",
    modelId: "meta-llama/llama-4-maverick",
    billingType: "tokens",
    inputUsdPer1M: 0.22,
    outputUsdPer1M: 0.66,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Meta",
    modelName: "Llama 4 Scout",
    modelId: "meta-llama/llama-4-scout",
    billingType: "tokens",
    inputUsdPer1M: 0.18,
    outputUsdPer1M: 0.59,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-5",
    modelId: "openai/gpt-5",
    billingType: "tokens",
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-5 Mini",
    modelId: "openai/gpt-5-mini",
    billingType: "tokens",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 2,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-4.1",
    modelId: "openai/gpt-4.1",
    billingType: "tokens",
    inputUsdPer1M: 2,
    outputUsdPer1M: 8,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-4.1 Mini",
    modelId: "openai/gpt-4.1-mini",
    billingType: "tokens",
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 1.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o3 Pro",
    modelId: "openai/o3-pro",
    billingType: "tokens",
    inputUsdPer1M: 20,
    outputUsdPer1M: 80,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "Anthropic",
    modelName: "Claude Opus 4",
    modelId: "anthropic/claude-opus-4",
    billingType: "tokens",
    inputUsdPer1M: 15,
    outputUsdPer1M: 75,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "Anthropic",
    modelName: "Claude Sonnet 4",
    modelId: "anthropic/claude-sonnet-4",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Anthropic",
    modelName: "Claude 3.7 Sonnet",
    modelId: "anthropic/claude-3-7-sonnet",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Anthropic",
    modelName: "Claude 3.5 Haiku",
    modelId: "anthropic/claude-3.5-haiku",
    billingType: "tokens",
    inputUsdPer1M: 0.8,
    outputUsdPer1M: 4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Anthropic",
    modelName: "Claude 3 Haiku",
    modelId: "anthropic/claude-3-haiku",
    billingType: "tokens",
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.25,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "OpenAI",
    modelName: "GPT Image 1",
    modelId: "openai/gpt-image-1",
    billingType: "image",
    usdPerImage: 0.011,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux 1 Dev",
    modelId: "black-forest-labs/flux-1-dev",
    billingType: "image",
    usdPerImage: 0.025,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Black Forest Labs",
    modelName: "Flux 1 Schnell",
    modelId: "black-forest-labs/flux-1-schnell",
    billingType: "image",
    usdPerImage: 0.003,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Recraft",
    modelName: "Recraft V3",
    modelId: "recraft-ai/recraft-v3",
    billingType: "image",
    usdPerImage: 0.04,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "Recraft",
    modelName: "Recraft 20B",
    modelId: "recraft-ai/recraft-20b",
    billingType: "image",
    usdPerImage: 0.04,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "BFL",
    modelName: "Flux Pro 1.1 Ultra",
    modelId: "bfl/flux-pro-1.1-ultra",
    billingType: "image",
    usdPerImage: 0.06,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "BFL",
    modelName: "Flux Pro",
    modelId: "bfl/flux-pro",
    billingType: "image",
    usdPerImage: 0.05,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "BFL",
    modelName: "Flux Dev",
    modelId: "bfl/flux-dev",
    billingType: "image",
    usdPerImage: 0.025,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Image generation",
    provider: "BFL",
    modelName: "Flux Schnell",
    modelId: "bfl/flux-schnell",
    billingType: "image",
    usdPerImage: 0.003,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "Safety / moderation",
    provider: "OpenAI",
    modelName: "Moderation",
    modelId: "openai/moderation",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.1,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "OpenAI",
    modelName: "GPT-4o",
    modelId: "openai/gpt-4o",
    billingType: "tokens",
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-4o Mini",
    modelId: "openai/gpt-4o-mini",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / coding",
    provider: "OpenAI",
    modelName: "GPT-4o Codex",
    modelId: "openai/gpt-4o-codex",
    billingType: "tokens",
    inputUsdPer1M: 1.5,
    outputUsdPer1M: 6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "o1",
    modelId: "openai/o1",
    billingType: "tokens",
    inputUsdPer1M: 15,
    outputUsdPer1M: 60,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o1 Mini",
    modelId: "openai/o1-mini",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 12,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o1 Pro",
    modelId: "openai/o1-pro",
    billingType: "tokens",
    inputUsdPer1M: 150,
    outputUsdPer1M: 600,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o3 Mini",
    modelId: "openai/o3-mini",
    billingType: "tokens",
    inputUsdPer1M: 1.1,
    outputUsdPer1M: 4.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "OpenAI",
    modelName: "o4 Mini High",
    modelId: "openai/o4-mini-high",
    billingType: "tokens",
    inputUsdPer1M: 1.1,
    outputUsdPer1M: 4.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 2.0 Flash",
    modelId: "google/gemini-2.0-flash-001",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.4,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Google",
    modelName: "Gemini 1.5 Flash",
    modelId: "google/gemini-1.5-flash",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "Google",
    modelName: "Gemini 2.0 Flash Thinking",
    modelId: "google/gemini-2.0-flash-thinking-exp",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "DeepSeek",
    modelName: "DeepSeek R1",
    modelId: "deepseek/deepseek-reasoner",
    billingType: "tokens",
    inputUsdPer1M: 0.55,
    outputUsdPer1M: 2.19,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "DeepSeek",
    modelName: "DeepSeek V3",
    modelId: "deepseek/deepseek-chat",
    billingType: "tokens",
    inputUsdPer1M: 0.27,
    outputUsdPer1M: 1.1,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "MoonshotAI",
    modelName: "Kimi K2",
    modelId: "moonshotai/kimi-k2",
    billingType: "tokens",
    inputUsdPer1M: 0.57,
    outputUsdPer1M: 2.3,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Qwen",
    modelName: "Qwen 3 235B",
    modelId: "qwen/qwen3-235b-a22b-thinking-2507",
    billingType: "tokens",
    inputUsdPer1M: 0.55,
    outputUsdPer1M: 2.2,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Mistral 7B Instruct",
    modelId: "mistralai/mistral-7b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.1,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Mistral AI",
    modelName: "Mixtral 8x7B Instruct",
    modelId: "mistralai/mixtral-8x7b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.7,
    outputUsdPer1M: 0.7,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Meta",
    modelName: "Llama 3.2 90B Vision Instruct",
    modelId: "meta-llama/llama-3.2-90b-vision-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 0.6,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / chat",
    provider: "Meta",
    modelName: "Llama 3.3 70B Instruct",
    modelId: "meta-llama/llama-3.3-70b-instruct",
    billingType: "tokens",
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.25,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "OpenAI",
    modelName: "GPT-4.5 Preview",
    modelId: "openai/gpt-4.5-preview",
    billingType: "tokens",
    inputUsdPer1M: 75,
    outputUsdPer1M: 150,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "xAI",
    modelName: "Grok 4 0709",
    modelId: "x-ai/grok-4-0709",
    billingType: "tokens",
    inputUsdPer1M: 3,
    outputUsdPer1M: 15,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Amazon",
    modelName: "Nova Lite 1.0",
    modelId: "amazon/nova-lite-v1",
    billingType: "tokens",
    inputUsdPer1M: 0.06,
    outputUsdPer1M: 0.24,
    sourceUrl: "https://developer.puter.com/ai/models/"
  },
  {
    serviceType: "LLM / multimodal",
    provider: "Amazon",
    modelName: "Nova 2 Lite",
    modelId: "amazon/nova-2-lite-v1",
    billingType: "tokens",
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    sourceUrl: "https://developer.puter.com/ai/amazon/nova-2-lite-v1/"
  },
  {
    serviceType: "LLM / reasoning",
    provider: "StepFun",
    modelName: "Step 3.5 Flash",
    modelId: "stepfun/step-3.5-flash",
    billingType: "tokens",
    inputUsdPer1M: 0.1,
    outputUsdPer1M: 0.3,
    sourceUrl: "https://developer.puter.com/ai/stepfun/step-3.5-flash/"
  }
];

export async function seedModelPrices() {
  await kv.set(MODEL_PRICES_KEY, MODEL_PRICES);

  for (const item of MODEL_PRICES) {
    await kv.set(`${MODEL_PRICE_PREFIX}${item.modelId}`, item);
  }

  return {
    ok: true,
    total: MODEL_PRICES.length,
    key: MODEL_PRICES_KEY
  };
}

export async function setUsdTryRate(rate: number) {
  await kv.set(USD_TRY_RATE_KEY, rate);
  return { ok: true, rate };
}

export async function getAllModelPrices() {
  return kv.get(MODEL_PRICES_KEY);
}

export async function getModelPrice(modelId: string) {
  return kv.get(`${MODEL_PRICE_PREFIX}${modelId}`);
}

export async function ensureModelsSeeded() {
  // Part 2.5: preserve admin overrides while merging seed catalog.
  const models = await kv.list('model:');
  const existingMap = new Map(models.map(m => [m.value.id, m.value]));

  const rate = (await kv.get(USD_TRY_RATE_KEY)) || 50.0;
  const now = new Date().toISOString();
  let mergedCount = 0;

  for (const p of MODEL_PRICES) {
    const id = p.modelId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const existing = existingMap.get(id);

    const isLlm = p.billingType === 'tokens';
    const seedSingle = isLlm ? null : (p.usdPerImage ?? null);
    const seedInput = isLlm ? (p.inputUsdPer1M ?? null) : null;
    const seedOutput = isLlm ? (p.outputUsdPer1M ?? null) : null;

    const marginMultiplier = Number(existing?.margin_multiplier ?? existing?.profit_multiplier ?? 1) || 1;
    const isActive = existing?.is_active ?? true;
    const isFavorite = existing?.is_favorite ?? false;
    const adminOverridePricing = Boolean(existing?.admin_override_pricing);

    const rawInputUsd = adminOverridePricing ? (existing?.raw_cost_input_usd ?? seedInput) : seedInput;
    const rawOutputUsd = adminOverridePricing ? (existing?.raw_cost_output_usd ?? seedOutput) : seedOutput;
    const rawSingleUsd = adminOverridePricing ? (existing?.raw_cost_single_usd ?? seedSingle) : seedSingle;

    let standardizedServiceType = 'chat';
    const rawType = (p.serviceType || '').toLowerCase();
    const modelName = (p.modelName || '').toLowerCase();

    if (rawType.includes('image')) {
      standardizedServiceType = 'image';
    } else if (rawType.includes('video')) {
      standardizedServiceType = modelName.includes('image') || modelName.includes('photo') ? 'image_to_video' : 'video';
    } else if (rawType.includes('audio') || rawType.includes('tts') || modelName.includes('tts') || modelName.includes('speech')) {
      standardizedServiceType = 'tts';
    } else if (rawType.includes('music') || modelName.includes('music')) {
      standardizedServiceType = 'music';
    }

    const modelRecord = {
      id,
      provider_name: p.provider,
      model_name: p.modelName,
      service_type: standardizedServiceType,
      billing_unit: isLlm ? '1M tokens' : '1 image',
      is_active: isActive,
      is_favorite: isFavorite,

      raw_cost_input_usd: rawInputUsd,
      raw_cost_output_usd: rawOutputUsd,
      raw_cost_single_usd: rawSingleUsd,

      usd_try_rate: rate,
      raw_cost_input_try: rawInputUsd !== null ? Number((rawInputUsd * rate).toFixed(4)) : null,
      raw_cost_output_try: rawOutputUsd !== null ? Number((rawOutputUsd * rate).toFixed(4)) : null,
      raw_cost_single_try: rawSingleUsd !== null ? Number((rawSingleUsd * rate).toFixed(4)) : null,

      margin_multiplier: marginMultiplier,
      profit_multiplier: marginMultiplier,

      sale_cost_input_usd: rawInputUsd !== null ? Number((rawInputUsd * marginMultiplier).toFixed(4)) : null,
      sale_cost_output_usd: rawOutputUsd !== null ? Number((rawOutputUsd * marginMultiplier).toFixed(4)) : null,
      sale_cost_single_usd: rawSingleUsd !== null ? Number((rawSingleUsd * marginMultiplier).toFixed(4)) : null,

      sale_cost_input_try: rawInputUsd !== null ? Number((rawInputUsd * marginMultiplier * rate).toFixed(4)) : null,
      sale_cost_output_try: rawOutputUsd !== null ? Number((rawOutputUsd * marginMultiplier * rate).toFixed(4)) : null,
      sale_cost_single_try: rawSingleUsd !== null ? Number((rawSingleUsd * marginMultiplier * rate).toFixed(4)) : null,

      ...calculateSaleCredits(rawInputUsd, rawOutputUsd, rawSingleUsd, marginMultiplier),

      metadata_json: {
        ...(p as any),
        ...(existing?.metadata_json || {}),
      },
      usage_count: existing?.usage_count ?? 0,
      revenue_try: existing?.revenue_try ?? 0,
      cost_try: existing?.cost_try ?? 0,
      profit_try: existing?.profit_try ?? 0,
      admin_override_pricing: adminOverridePricing,
      last_rate_sync_at: now,
      last_price_sync_at: now,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await kv.set(`model:${id}`, modelRecord);
    mergedCount++;
  }

  return { ok: true, message: `Merged ${mergedCount} models` };
}

// ISTERSEN BOYLE BIR KULLAN:
// await seedModelPrices();
// await setUsdTryRate(50);