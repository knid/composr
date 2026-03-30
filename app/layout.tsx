import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Toaster } from "sonner"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Composr",
  description: "The prompt compiler for AI-first teams",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body className="antialiased">
          {children}
          <Toaster theme="dark" />
        </body>
      </html>
    </ClerkProvider>
  )
}
