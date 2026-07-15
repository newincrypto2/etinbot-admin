'use server'

import { revalidatePath } from 'next/cache'

import { assertRoleOrFail } from '@/lib/auth-helpers'
import { callBackend, callBackendGet } from '@/lib/backend'

// ─── Typy ────────────────────────────────────────────────────────────────────

export type VoiceTool = {
  name: string
  url: string
  method: string
  auth?: string | null
  description_pl: string
  body_schema?: unknown
}

export type VoicePromptResult =
  | {
      ok: true
      prompt: string
      tools: VoiceTool[]
      toolsNote: string | null
      agentId: string | null
      vertical: string | null
      escalationMode: 'callback' | 'transfer'
    }
  | { ok: false; message: string }

// ─── Wygeneruj prompt voice + narzędzia ──────────────────────────────────────

export async function generateVoicePrompt(slug: string): Promise<VoicePromptResult> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }

  const r = await callBackendGet(`/api/admin/voice-prompt?slug=${encodeURIComponent(slug)}`)
  if (!r.ok) {
    return { ok: false, message: `Nie udało się wygenerować promptu (${r.status}). ${r.text.slice(0, 160)}` }
  }
  const d = r.data
  const escalationMode = d.escalation_mode === 'transfer' ? 'transfer' : 'callback'
  return {
    ok: true,
    prompt: typeof d.prompt === 'string' ? d.prompt : '',
    tools: Array.isArray(d.tools) ? (d.tools as VoiceTool[]) : [],
    toolsNote: (d.tools_note as string | null) ?? null,
    agentId: (d.agent_id as string | null) ?? null,
    vertical: (d.vertical as string | null) ?? null,
    escalationMode,
  }
}

// ─── Zapisz elevenlabs_agent_id (kolumna) ────────────────────────────────────

export async function saveAgentId(
  slug: string,
  agentId: string,
): Promise<{ ok: boolean; message: string; agentId?: string | null }> {
  const guard = await assertRoleOrFail('SUPERADMIN')
  if (!guard.ok) return { ok: false, message: guard.message }
  const r = await callBackend('/api/admin/set-agent-id', { slug, agent_id: agentId.trim() || null })
  if (!r.ok) {
    return { ok: false, message: `Nie udało się zapisać agent_id (${r.status}). ${r.text.slice(0, 140)}` }
  }
  revalidatePath(`/clients/${slug}`)
  const saved = (r.data.agent_id as string | null) ?? null
  return { ok: true, message: saved ? 'Zapisano agent_id — kanał voice aktywny.' : 'Wyczyszczono agent_id.', agentId: saved }
}
