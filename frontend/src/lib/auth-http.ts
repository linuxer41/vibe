import type { BackendConfig } from './backend-config'

function getHttpUrl(): string {
  const raw = localStorage.getItem('wa_backend_config')
  if (raw) {
    try {
      const cfg: BackendConfig = JSON.parse(raw)
      if (cfg.httpUrl) return cfg.httpUrl
    } catch {}
  }
  const mode = import.meta.env.VITE_BACKEND || 'node'
  return mode === 'rust' ? 'http://localhost:2001' : 'http://localhost:2000'
}

async function httpPost(path: string, body: any): Promise<any> {
  const base = getHttpUrl()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export async function sendCode(phone: string): Promise<string> {
  const data = await httpPost('/auth/send-code', { phone })
  if (!data.ok) throw new Error(data.error || 'Error al enviar código')
  return data.code
}

export async function verifyCode(
  phone: string,
  code: string,
  username?: string,
  displayName?: string,
  countryCode?: string,
): Promise<{ token: string; userId: number; displayName: string; avatar: string; isNew: boolean }> {
  const data = await httpPost('/auth/verify-code', {
    phone, code, username, displayName, countryCode,
  })
  if (!data.ok) throw new Error(data.error || 'Código inválido')
  return {
    token: data.token,
    userId: data.userId,
    displayName: data.displayName,
    avatar: data.avatar,
    isNew: data.isNew,
  }
}

export async function restoreSession(token: string): Promise<any> {
  const data = await httpPost('/auth/restore', { token })
  if (!data.ok) throw new Error(data.error || 'Sesión inválida')
  return data.user
}
