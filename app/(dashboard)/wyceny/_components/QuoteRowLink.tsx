'use client'

import { useRouter } from 'next/navigation'

/** Wiersz tabeli klikalny do karty wyceny (Link nie może opakować <tr>). */
export function QuoteRowLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <tr
      onClick={() => router.push(href)}
      className="align-top cursor-pointer hover:bg-slate-50 transition-colors"
    >
      {children}
    </tr>
  )
}
