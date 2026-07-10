// Wspólny klient HTTP do backendu bota (BOT_API_URL + BOT_API_KEY).
// Wzorzec z actions/client-config.ts / actions/clients.ts wyniesiony do jednego
// miejsca, żeby nowe akcje (idobooking, sync) nie duplikowały fetch/auth.
// Używać TYLKO z server actions ('use server') — trzyma sekret BOT_API_KEY.

export type BackendResult = {
  ok: boolean
  status: number
  data: Record<string, unknown>
  text: string
}

async function request(path: string, init: RequestInit): Promise<BackendResult> {
  const base = process.env.BOT_API_URL
  const key = process.env.BOT_API_KEY
  if (!base || !key) {
    return { ok: false, status: 0, data: {}, text: 'Brak BOT_API_URL / BOT_API_KEY w env panelu.' }
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    })
    const text = await res.text().catch(() => '')
    let data: Record<string, unknown> = {}
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
    } catch {
      /* ignore — niepoprawny JSON, zostaje text */
    }
    return { ok: res.ok, status: res.status, data, text }
  } catch (e) {
    return { ok: false, status: 0, data: {}, text: `Błąd połączenia: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export function callBackend(path: string, body: Record<string, unknown>): Promise<BackendResult> {
  return request(path, { method: 'POST', body: JSON.stringify(body) })
}

export function callBackendGet(path: string): Promise<BackendResult> {
  return request(path, { method: 'GET' })
}
