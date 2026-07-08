export interface BackendConfig {
  wsUrl: string
  tcpUrl: string
  httpUrl: string
  label?: string
}

export function getBackendConfig(): BackendConfig {
  const raw = localStorage.getItem('wa_backend_config')
  if (raw) {
    try {
      const cfg: BackendConfig = JSON.parse(raw)
      if (cfg.wsUrl || cfg.httpUrl || cfg.tcpUrl) return cfg
    } catch {}
  }
  const mode = import.meta.env.VITE_BACKEND || 'node'
  if (mode === 'rust') {
    return { wsUrl: 'ws://localhost:3001', tcpUrl: '127.0.0.1:5000', httpUrl: 'http://localhost:2001', label: 'Rust' }
  }
  return { wsUrl: 'ws://localhost:3000', tcpUrl: '127.0.0.1:4000', httpUrl: 'http://localhost:2000', label: 'Node.js' }
}

export function setBackendConfig(cfg: BackendConfig) {
  localStorage.setItem('wa_backend_config', JSON.stringify(cfg))
  localStorage.setItem('wa_backend_label', cfg.label || 'Custom')
}
