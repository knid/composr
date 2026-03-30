"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, GitBranch, Boxes, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compositions", label: "Compositions", icon: GitBranch },
  { href: "/blocks", label: "Blocks", icon: Boxes },
]

const bottomItems = [
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-dvh w-[200px] flex-col border-r border-border bg-background p-2">
      <div className="flex items-center gap-2 px-2 py-1 mb-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-primary to-blue-500">
          <span className="text-[10px] font-extrabold text-white">P</span>
        </div>
        <span className="text-sm font-semibold tracking-tight">PromptKit</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              pathname === item.href
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 opacity-50" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-2">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              pathname === item.href
                ? "bg-secondary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 opacity-50" />
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  )
}
