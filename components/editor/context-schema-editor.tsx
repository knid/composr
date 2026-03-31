"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, X } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

export interface ContextField {
  name: string
  type: "string" | "boolean" | "enum" | "number"
  values?: string[]
}

interface ContextSchemaEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: ContextField[]
  onSchemaChange: (schema: ContextField[]) => void
}

export function ContextSchemaEditor({
  open,
  onOpenChange,
  schema,
  onSchemaChange,
}: ContextSchemaEditorProps) {
  const [fields, setFields] = useState<ContextField[]>(schema)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<"string" | "boolean" | "enum" | "number">("string")

  // Sync when opening
  const handleOpenChange = useCallback((next: boolean) => {
    if (next) setFields(schema)
    onOpenChange(next)
  }, [schema, onOpenChange])

  const addField = useCallback(() => {
    if (!newName.trim()) return
    const field: ContextField = {
      name: newName.trim(),
      type: newType,
      ...(newType === "enum" ? { values: ["value1", "value2"] } : {}),
    }
    setFields([...fields, field])
    setNewName("")
    setNewType("string")
  }, [fields, newName, newType])

  const removeField = useCallback((index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }, [fields])

  const updateFieldType = useCallback((index: number, type: "string" | "boolean" | "enum" | "number") => {
    setFields(fields.map((f, i) => {
      if (i !== index) return f
      return {
        ...f,
        type,
        values: type === "enum" ? (f.values ?? ["value1", "value2"]) : undefined,
      }
    }))
  }, [fields])

  const updateEnumValue = useCallback((fieldIndex: number, valueIndex: number, value: string) => {
    setFields(fields.map((f, i) => {
      if (i !== fieldIndex || !f.values) return f
      const updated = [...f.values]
      updated[valueIndex] = value
      return { ...f, values: updated }
    }))
  }, [fields])

  const addEnumValue = useCallback((fieldIndex: number) => {
    setFields(fields.map((f, i) => {
      if (i !== fieldIndex || !f.values) return f
      return { ...f, values: [...f.values, ""] }
    }))
  }, [fields])

  const removeEnumValue = useCallback((fieldIndex: number, valueIndex: number) => {
    setFields(fields.map((f, i) => {
      if (i !== fieldIndex || !f.values) return f
      return { ...f, values: f.values.filter((_, vi) => vi !== valueIndex) }
    }))
  }, [fields])

  const save = useCallback(() => {
    onSchemaChange(fields)
    onOpenChange(false)
  }, [fields, onSchemaChange, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Context Schema</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Define the context parameters available for IF conditions and variable interpolation.
        </p>

        <div className="space-y-3 mt-2">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">No context fields defined yet.</p>
          )}

          {fields.map((field, fi) => (
            <div key={fi} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium font-mono flex-1">{field.name}</span>
                <select
                  value={field.type}
                  onChange={(e) => updateFieldType(fi, e.target.value as "string" | "boolean" | "enum" | "number")}
                  className="rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground outline-none"
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                  <option value="enum">enum</option>
                </select>
                <button
                  onClick={() => removeField(fi)}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {field.type === "enum" && field.values && (
                <div className="pl-2 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Values</span>
                  {field.values.map((v, vi) => (
                    <div key={vi} className="flex items-center gap-1">
                      <Input
                        value={v}
                        onChange={(e) => updateEnumValue(fi, vi, e.target.value)}
                        className="h-6 text-xs flex-1"
                      />
                      <button
                        onClick={() => removeEnumValue(fi, vi)}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] gap-1 px-1.5"
                    onClick={() => addEnumValue(fi)}
                  >
                    <Plus className="h-3 w-3" /> Add value
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add new field */}
        <div className="border-t border-border pt-3 mt-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Field name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addField() }}
              className="flex-1 h-8 text-xs"
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "string" | "boolean" | "enum" | "number")}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="enum">enum</option>
            </select>
            <Button size="sm" className="gap-1 h-8" onClick={addField} disabled={!newName.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save Schema
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
