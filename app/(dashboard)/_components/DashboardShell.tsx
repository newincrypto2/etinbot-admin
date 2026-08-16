'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import type { ModuleId } from '@/lib/modules'
import type { TenantTileData } from '@/components/layout/TenantTile'

type DashboardShellProps = {
  user: { name?: string | null; email?: string | null; role: string }
  permissions: Record<string, boolean>
  /** Efektywny stan modułów aktywnego tenanta (lib/modules-server.ts) — steruje menu Sidebara i paletą Ctrl+K. */
  modules: Record<ModuleId, boolean>
  vertical?: string | null
  /** Tenant aktywny w tej sesji — kafel w sidebarze. */
  activeTenant: TenantTileData
  /** Lista tenantów do przełączania w kafelku — tylko dla SUPERADMIN bez przypisanego klienta, inaczej null. */
  tenantList: TenantTileData[] | null
  children: React.ReactNode
}

export function DashboardShell({
  user,
  permissions,
  modules,
  vertical,
  activeTenant,
  tenantList,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50/80 overflow-hidden">
      <Sidebar
        permissions={permissions}
        modules={modules}
        vertical={vertical}
        activeTenant={activeTenant}
        tenantList={tenantList}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={user}
          modules={modules}
          permissions={permissions}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
