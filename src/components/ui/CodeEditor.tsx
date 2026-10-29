import { useCallback, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { xml } from "@codemirror/lang-xml";
import { EditorView } from "@codemirror/view";
import { useThemeStore } from "@/store/themeStore";
import { DataFormat } from "@/types";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  format?: DataFormat;
  placeholder?: string;
  height?: string;
  readOnly?: boolean;
}

// Custom theme extensions for light and dark modes
const lightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "rgb(250 250 250)", // zinc-50
      fontSize: "11px",
    },
    ".cm-gutters": {
      backgroundColor: "rgb(244 244 245)", // zinc-100
      borderRight: "1px solid rgb(228 228 231)", // zinc-200
      color: "rgb(161 161 170)", // zinc-400
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgb(228 228 231)", // zinc-200
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(244 244 245)", // zinc-100
    },
    ".cm-cursor": {
      borderLeftColor: "rgb(39 39 42)", // zinc-800
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgb(212 212 216) !important", // zinc-300
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgb(212 212 216) !important",
    },
    ".cm-content": {
      caretColor: "rgb(39 39 42)", // zinc-800
    },
    ".cm-placeholder": {
      color: "rgb(161 161 170)", // zinc-400
    },
  },
  { dark: false },
);

const darkTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "rgb(24 24 27)", // zinc-900
      fontSize: "11px",
    },
    ".cm-gutters": {
      backgroundColor: "rgb(24 24 27)", // zinc-900
      borderRight: "1px solid rgb(39 39 42)", // zinc-800
      color: "rgb(82 82 91)", // zinc-600
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgb(39 39 42)", // zinc-800
    },
    ".cm-activeLine": {
      backgroundColor: "rgb(39 39 42 / 0.5)", // zinc-800/50
    },
    ".cm-cursor": {
      borderLeftColor: "rgb(244 244 245)", // zinc-100
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgb(63 63 70) !important", // zinc-700
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgb(63 63 70) !important",
    },
    ".cm-content": {
      caretColor: "rgb(244 244 245)", // zinc-100
    },
    ".cm-placeholder": {
      color: "rgb(82 82 91)", // zinc-600
    },
  },
  { dark: true },
);

// Syntax highlighting colors
const syntaxHighlightingLight = EditorView.theme({
  ".cm-string": { color: "rgb(22 163 74)" }, // green-600
  ".cm-number": { color: "rgb(37 99 235)" }, // blue-600
  ".cm-keyword": { color: "rgb(147 51 234)" }, // purple-600
  ".cm-propertyName": { color: "rgb(220 38 38)" }, // red-600
  ".cm-bool": { color: "rgb(217 119 6)" }, // amber-600
  ".cm-null": { color: "rgb(107 114 128)" }, // gray-500
  ".cm-punctuation": { color: "rgb(82 82 91)" }, // zinc-600
  ".cm-bracket": { color: "rgb(82 82 91)" }, // zinc-600
});

const syntaxHighlightingDark = EditorView.theme({
  ".cm-string": { color: "rgb(134 239 172)" }, // green-300
  ".cm-number": { color: "rgb(147 197 253)" }, // blue-300
  ".cm-keyword": { color: "rgb(216 180 254)" }, // purple-300
  ".cm-propertyName": { color: "rgb(252 165 165)" }, // red-300
  ".cm-bool": { color: "rgb(252 211 77)" }, // amber-300
  ".cm-null": { color: "rgb(156 163 175)" }, // gray-400
  ".cm-punctuation": { color: "rgb(161 161 170)" }, // zinc-400
  ".cm-bracket": { color: "rgb(161 161 170)" }, // zinc-400
});

export function CodeEditor({
  value,
  onChange,
  format = "json",
  placeholder,
  height = "180px",
  readOnly = false,
}: CodeEditorProps) {
  const { theme } = useThemeStore();

  // Determine if dark mode is active
  const isDark = useMemo(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return theme === "dark";
  }, [theme]);

  // Get language extension based on format
  const getLanguageExtension = useCallback(() => {
    switch (format) {
      case "json":
        return json();
      case "xml":
        return xml();
      case "protobuf":
      case "avro":
        // Use JSON-like highlighting for these
        return json();
      case "binary":
      case "text":
        return [];
    }
  }, [format]);

  const extensions = useMemo(() => {
    const exts = [
      EditorView.lineWrapping,
      isDark ? darkTheme : lightTheme,
      isDark ? syntaxHighlightingDark : syntaxHighlightingLight,
    ];

    const langExt = getLanguageExtension();
    if (langExt) {
      exts.push(langExt);
    }

    return exts;
  }, [isDark, getLanguageExtension]);

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors">
      <CodeMirror
        value={value}
        height={height}
        theme={isDark ? "dark" : "light"}
        extensions={extensions}
        onChange={onChange}
        {...(placeholder !== undefined ? { placeholder } : {})}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
          tabSize: 2,
        }}
      />
    </div>
  );
}
