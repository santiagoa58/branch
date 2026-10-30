import { create } from "zustand";
import {
  AISettings,
  AIProviderType,
  AIModel,
  ArchitectureAnalysis,
  ConnectionSuggestion,
  ChatMessage,
} from "@/types/ai";
import { aiSettingsSchema } from "@/schemas/persistence";

const STORAGE_KEY = "ai-settings";
const CACHE_DURATION = 5 * 60 * 1000;
let analysisCache: {
  diagramHash: string;
  analysis: ArchitectureAnalysis;
  expiresAt: number;
} | null = null;

interface AIStore extends AISettings {
  // State
  isAnalyzing: boolean;
  lastAnalysis: ArchitectureAnalysis | null;
  suggestions: ConnectionSuggestion[];
  chatHistory: ChatMessage[];
  error: string | null;
  isConfigured: boolean;

  // Actions
  setApiKey: (key: string) => void;
  setProvider: (provider: AIProviderType) => void;
  setModel: (model: AIModel) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setLastAnalysis: (analysis: ArchitectureAnalysis | null) => void;
  setSuggestions: (suggestions: ConnectionSuggestion[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  clearSessionAnalysis: () => void;
  setError: (error: string | null) => void;
  acceptSuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;

  // Cache
  getCachedAnalysis: (diagramHash: string) => ArchitectureAnalysis | null;
  cacheAnalysis: (diagramHash: string, analysis: ArchitectureAnalysis) => void;

  // Persistence
  loadSettings: () => void;
  saveSettings: () => void;
  clearSettings: () => void;
}

export const useAIStore = create<AIStore>((set, get) => ({
  // Initial state
  provider: "openai",
  apiKey: null,
  model: "gpt-4-turbo",
  isAnalyzing: false,
  lastAnalysis: null,
  suggestions: [],
  chatHistory: [],
  error: null,
  isConfigured: false,

  // Actions
  setApiKey: (key) => {
    set({ apiKey: key, isConfigured: !!key, error: null });
    get().saveSettings();
  },

  setProvider: (provider) => {
    set({ provider });
    get().saveSettings();
  },

  setModel: (model) => {
    set({ model });
    get().saveSettings();
  },

  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

  setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),

  setSuggestions: (suggestions) => set({ suggestions }),

  addChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  clearChatHistory: () => set({ chatHistory: [] }),
  clearSessionAnalysis: () => {
    analysisCache = null;
    set({ lastAnalysis: null, suggestions: [], chatHistory: [], error: null });
  },

  setError: (error) => set({ error }),

  acceptSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.map((s) => (s.id === id ? { ...s, accepted: true } : s)),
    })),

  dismissSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    })),

  // Diagram-derived analysis stays in memory; only provider preferences/keys persist.
  getCachedAnalysis: (diagramHash) =>
    analysisCache?.diagramHash === diagramHash && Date.now() < analysisCache.expiresAt
      ? analysisCache.analysis
      : null,
  cacheAnalysis: (diagramHash, analysis) => {
    analysisCache = { diagramHash, analysis, expiresAt: Date.now() + CACHE_DURATION };
  },

  // Persistence
  loadSettings: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const rawSettings: unknown = JSON.parse(saved);
        const result = aiSettingsSchema.safeParse(rawSettings);
        if (!result.success) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        const settings = result.data;
        set({
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          isConfigured: !!settings.apiKey,
        });
      }
    } catch (error) {
      console.error("Failed to load AI settings:", error);
    }
  },

  saveSettings: () => {
    try {
      const settings: AISettings = {
        provider: get().provider,
        apiKey: get().apiKey,
        model: get().model,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save AI settings:", error);
    }
  },

  clearSettings: () => {
    set({
      apiKey: null,
      isConfigured: false,
      lastAnalysis: null,
      suggestions: [],
      chatHistory: [],
      error: null,
    });
    localStorage.removeItem(STORAGE_KEY);
    analysisCache = null;
  },
}));

// Load settings on initialization
if (typeof window !== "undefined") {
  useAIStore.getState().loadSettings();
}
