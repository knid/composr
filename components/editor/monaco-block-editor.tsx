"use client"

import { useRef, useCallback } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"

interface MonacoBlockEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string
}

export function MonacoBlockEditor({
  value,
  onChange,
  readOnly = false,
  height = "200px",
}: MonacoBlockEditorProps) {
  const editorRef = useRef<any>(null)

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    monaco.editor.defineTheme("composr-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "variable.template", foreground: "7c3aed", fontStyle: "bold" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#a1a1aa",
        "editor.lineHighlightBackground": "#18181b",
        "editor.selectionBackground": "#27272a",
        "editorCursor.foreground": "#7c3aed",
        "editorLineNumber.foreground": "#3f3f46",
        "editorLineNumber.activeForeground": "#71717a",
      },
    })
    monaco.editor.setTheme("composr-dark")

    if (!monaco.languages.getLanguages().some((l: any) => l.id === "promptblock")) {
      monaco.languages.register({ id: "promptblock" })
      monaco.languages.setMonarchTokensProvider("promptblock", {
        tokenizer: {
          root: [
            [/\{\{[^}]+\}\}/, "variable.template"],
          ],
        },
      })
    }

    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: readOnly ? "off" : "on",
      scrollBeyondLastLine: false,
      wordWrap: "on",
      fontSize: 12,
      fontFamily: "var(--font-geist-mono), monospace",
      readOnly,
      renderLineHighlight: readOnly ? "none" : "line",
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: "auto",
        horizontal: "hidden",
        verticalScrollbarSize: 6,
      },
      padding: { top: 8, bottom: 8 },
    })
  }, [readOnly])

  const handleChange = useCallback(
    (val: string | undefined) => {
      if (onChange && val !== undefined) onChange(val)
    },
    [onChange]
  )

  const tokenCount = Math.round(value.length / 4)

  return (
    <div>
      <div className="rounded-md border border-border overflow-hidden">
        <Editor
          height={height}
          language="promptblock"
          value={value}
          onChange={handleChange}
          onMount={handleMount}
          theme="composr-dark"
          options={{ readOnly }}
          loading={
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
              Loading editor...
            </div>
          }
        />
      </div>
      {!readOnly && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono">{tokenCount} tokens</span>
          <span className="text-border">|</span>
          <span>{value.length} chars</span>
        </div>
      )}
    </div>
  )
}
