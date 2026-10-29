import { useState } from "react";
import { X, Key, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useAIStore } from "@/store/aiStore";
import { cn } from "@/lib/utils";
import { AIModel, AIProviderType } from "@/types/ai";
import { OpenAIProvider } from "@/services/ai";
import { aiModelSchema } from "@/schemas/persistence";
import { applyValidatedInput } from "@/lib/validatedInput";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODELS: Record<AIProviderType, { value: AIModel; label: string; description: string }[]> = {
  openai: [
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", description: "Most capable, higher cost" },
    { value: "gpt-4", label: "GPT-4", description: "Powerful and accurate" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", description: "Fast and cost-effective" },
  ],
  anthropic: [
    { value: "claude-3-opus", label: "Claude 3 Opus", description: "Most capable" },
    { value: "claude-3-sonnet", label: "Claude 3 Sonnet", description: "Balanced" },
  ],
};

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { provider, apiKey, model, setApiKey, setProvider, setModel, clearSettings } = useAIStore();

  const [localApiKey, setLocalApiKey] = useState(apiKey || "");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const handleSave = () => {
    setApiKey(localApiKey);
    onClose();
  };

  const handleTest = async () => {
    if (!localApiKey) {
      setTestResult("error");
      setTestMessage("Please enter an API key");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestMessage("");

    try {
      const testProvider = new OpenAIProvider(localApiKey, model);

      // Simple test: try to create a completion
      await testProvider.chat(
        [{ id: "test", role: "user", content: "Hi", timestamp: new Date() }],
        { nodes: [], edges: [] },
      );

      setTestResult("success");
      setTestMessage("Connection successful!");
    } catch (error) {
      setTestResult("error");
      setTestMessage(error instanceof Error ? error.message : "Failed to connect to AI provider");
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear all AI settings?")) {
      clearSettings();
      setLocalApiKey("");
      setTestResult(null);
      setTestMessage("");
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">AI Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Info Banner */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Privacy Note:</strong> Your API key is stored locally in your browser and
              never sent to our servers. All AI requests go directly from your browser to the AI
              provider.
            </p>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              AI Provider
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProvider("openai")}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-left",
                  provider === "openai"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                    : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400",
                )}
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">OpenAI</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">GPT-4, GPT-3.5</div>
              </button>
              <button
                type="button"
                onClick={() => setProvider("anthropic")}
                disabled
                className="p-4 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-left opacity-50 cursor-not-allowed"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">Anthropic</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Coming soon</div>
              </button>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label
              htmlFor="ai-model"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Model
            </label>
            <select
              id="ai-model"
              value={model}
              onChange={(e) => applyValidatedInput(aiModelSchema, e.target.value, setModel)}
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-zinc-100"
            >
              {MODELS[provider].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} - {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label
              htmlFor="ai-api-key"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="ai-api-key"
                type={showApiKey ? "text" : "password"}
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder={provider === "openai" ? "sk-..." : "Enter API key"}
                className="w-full pl-10 pr-20 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {showApiKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Get your API key from{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                OpenAI Dashboard
              </a>
            </p>
          </div>

          {/* Test Connection */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                void handleTest();
              }}
              disabled={testing || !localApiKey}
              className={cn(
                "w-full px-4 py-2 rounded-lg font-medium transition-colors",
                testing || !localApiKey
                  ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600",
              )}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>

            {testResult && (
              <div
                className={cn(
                  "flex items-start gap-2 p-3 rounded-lg",
                  testResult === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800",
                )}
              >
                {testResult === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <p
                  className={cn(
                    "text-sm",
                    testResult === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300",
                  )}
                >
                  {testMessage}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
          >
            Clear Settings
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
