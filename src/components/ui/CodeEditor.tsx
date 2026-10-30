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

// Neutral editor surfaces follow the same tokens as the surrounding form.
function editorTheme(dark: boolean) {
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--card)",
        color: "var(--card-foreground)",
        fontSize: "11px",
      },
      ".cm-gutters": {
        backgroundColor: "var(--card)",
        borderRight: "1px solid var(--border)",
        color: "var(--muted-foreground)",
      },
      ".cm-activeLineGutter, .cm-activeLine": { backgroundColor: "var(--muted)" },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "color-mix(in srgb, var(--foreground) 20%, var(--card)) !important",
      },
      ".cm-content": { caretColor: "var(--foreground)" },
      ".cm-placeholder": { color: "var(--muted-foreground)" },
    },
    { dark },
  );
}
const lightTheme = editorTheme(false);
const darkTheme = editorTheme(true);

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
  const isDark = useThemeStore((state) => state.resolvedTheme === "dark");

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
    <div className="rounded border border-input overflow-hidden focus-within:border-ring transition-colors">
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
