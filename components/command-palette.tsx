"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard, GitBranch, Boxes, Settings, Beaker, Target,
  BarChart3, ScrollText, Workflow, Activity, Plus,
} from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compositions", label: "Compositions", icon: GitBranch },
  { href: "/blocks", label: "Blocks", icon: Boxes },
  { href: "/pipelines", label: "Pipelines", icon: Workflow },
  { href: "/experiments", label: "Experiments", icon: Beaker },
  { href: "/scoring", label: "Scoring", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/usage", label: "Usage", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface Item {
  id: string
  name: string
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [initialFilter, setInitialFilter] = useState("")
  const [compositions, setCompositions] = useState<Item[]>([])
  const [blocks, setBlocks] = useState<Item[]>([])

  useEffect(() => {
    if (!open) return
    fetch("/api/compositions").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setCompositions(data.map((c: any) => ({ id: c.id, name: c.name })))
    }).catch(() => {})
    fetch("/api/blocks").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setBlocks(data.map((b: any) => ({ id: b.id, name: b.name })))
    }).catch(() => {})
  }, [open])

  const openWith = useCallback((filter: string) => {
    setInitialFilter(filter)
    setOpen(true)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === "k") {
        e.preventDefault()
        openWith("")
      } else if (mod && e.key === "e") {
        e.preventDefault()
        openWith("block:")
      } else if (mod && e.key === "p") {
        e.preventDefault()
        openWith("comp:")
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [openWith])

  function select(href: string) {
    setOpen(false)
    setInitialFilter("")
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInitialFilter("") }}>
      <CommandInput
        placeholder="Type a command or search..."
        defaultValue={initialFilter}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navItems.map((item) => (
            <CommandItem key={item.href} onSelect={() => select(item.href)}>
              <item.icon className="mr-2 h-4 w-4 opacity-50" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Compositions">
          {compositions.map((comp) => (
            <CommandItem
              key={comp.id}
              value={`comp:${comp.name}`}
              onSelect={() => select(`/compositions/${comp.id}`)}
            >
              <GitBranch className="mr-2 h-4 w-4 opacity-50" />
              {comp.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Blocks">
          {blocks.map((block) => (
            <CommandItem
              key={block.id}
              value={`block:${block.name}`}
              onSelect={() => select("/blocks")}
            >
              <Boxes className="mr-2 h-4 w-4 opacity-50" />
              {block.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => select("/compositions")}>
            <Plus className="mr-2 h-4 w-4 opacity-50" />
            Create new composition
          </CommandItem>
          <CommandItem onSelect={() => select("/blocks")}>
            <Plus className="mr-2 h-4 w-4 opacity-50" />
            Create new block
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
