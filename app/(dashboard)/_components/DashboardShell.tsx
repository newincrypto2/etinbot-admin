'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

type DashboardShellProps = {
  user: { name?: string | null; email?: string | null; role: string }
  permissions: Record<string, boolean>
  tenantSelector?: React.ReactNode
  vertical?: string | null
  children: React.ReactNode
}

export function DashboardShell({ user, permissions, tenantSelector, vertical, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50/80 overflow-hidden">
      <Sidebar
        permissions={permissions}
        vertical={vertical}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          tenantSelector={tenantSelector}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
