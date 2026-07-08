<script lang="ts">
	import { onMount } from 'svelte';

	const PLATFORMS = [
		{ id: 'android', label: 'Android', icon: '📱', arch: 'arm64', ext: '.apk' },
		{ id: 'windows', label: 'Windows', icon: '🪟', arch: 'x86_64', ext: '.msi' },
		{ id: 'macos', label: 'macOS', icon: '🍎', arch: 'aarch64', ext: '.dmg' },
		{ id: 'linux', label: 'Linux', icon: '🐧', arch: 'x86_64', ext: '.AppImage' },
	] as const;

	let versions = $state<Record<string, Record<string, { filename: string; size: number; sha256: string; uploadedAt: string }>>>({});
	let loading = $state(true);

	onMount(() => {
		fetch('/api/versions')
			.then(r => r.json())
			.then(d => { versions = d; })
			.catch(() => {})
			.finally(() => loading = false);
	});

	function formatSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function downloadUrl(p: typeof PLATFORMS[number]): string {
		return `/api/download/${p.id}/${p.arch}`;
	}

	function versionFor(p: typeof PLATFORMS[number]) {
		return versions[p.id]?.[p.arch];
	}

	function formatDate(iso: string): string {
		return new Date(iso + 'Z').toLocaleDateString('es', {
			year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}
</script>

<!-- Hero -->
<section class="hero">
	<div class="hero-bg"></div>
	<div class="hero-content">
		<div class="hero-logo">
			<svg width="64" height="64" viewBox="0 0 32 32" fill="var(--accent)">
				<rect width="32" height="32" rx="8" />
				<text x="16" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#000">V</text>
			</svg>
		</div>
		<h1 class="hero-title">Vibe</h1>
		<p class="hero-tagline">Chat. Watch. Live.</p>
		<p class="hero-desc">Mensajería instantánea, live streaming, llamadas, y más — todo en una app moderna y open source.</p>
		<a href="#download" class="hero-cta">Descargar ahora</a>
	</div>
</section>

<!-- Features -->
<section id="features" class="section">
	<h2 class="section-title">Características</h2>
	<div class="features-grid">
		<div class="feature-card">
			<span class="feature-icon">💬</span>
			<h3>Mensajería</h3>
			<p>Chats privados y grupales con texto, imágenes, video, audio y documentos.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon">📡</span>
			<h3>Live Streaming</h3>
			<p>Transmite en vivo con comentarios, reacciones y gifts en tiempo real.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon">📞</span>
			<h3>Llamadas</h3>
			<p>Llamadas de audio y video peer-to-peer con WebRTC.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon">📱</span>
			<h3>Multiplataforma</h3>
			<p>Disponible para Android, Windows, macOS y Linux.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon">🔒</span>
			<h3>Privacidad</h3>
			<p>Controla quién ve tu información. Autenticación por SMS y PIN local.</p>
		</div>
		<div class="feature-card">
			<span class="feature-icon">🎮</span>
			<h3>Juegos & Canales</h3>
			<p>Juegos multijugador, canales, comunidades y watch together.</p>
		</div>
	</div>
</section>

<!-- Download -->
<section id="download" class="section download-section">
	<h2 class="section-title">Descargar Vibe</h2>
	<p class="section-desc">Elige tu plataforma y descarga la última versión.</p>

	{#if loading}
		<p class="loading-text">Cargando versiones disponibles...</p>
	{:else}
		<div class="download-grid">
			{#each PLATFORMS as p}
				{@const v = versionFor(p)}
				<a href={v ? downloadUrl(p) : '#'} class="download-card" class:disabled={!v} download={v?.filename}>
					<span class="dl-icon">{p.icon}</span>
					<span class="dl-platform">{p.label}</span>
					<span class="dl-arch">{p.arch}{p.ext}</span>
					{#if v}
						<span class="dl-size">{formatSize(v.size)}</span>
						<span class="dl-date">{formatDate(v.uploadedAt)}</span>
					{:else}
						<span class="dl-na">No disponible</span>
					{/if}
				</a>
			{/each}
		</div>

		{#if Object.keys(versions).length > 0}
			<details class="versions-details">
				<summary>Ver detalles técnicos</summary>
				<div class="versions-table">
					{#each Object.entries(versions) as [platform, archs]}
						{#each Object.entries(archs) as [arch, info]}
							<div class="version-row">
								<code>{platform}/{arch}</code>
								<code>{info.filename}</code>
								<code>{formatSize(info.size)}</code>
								<code class="hash" title={info.sha256}>{info.sha256.slice(0, 16)}…</code>
							</div>
						{/each}
					{/each}
				</div>
			</details>
		{/if}
	{/if}
</section>

<!-- Open Source -->
<section class="section oss-section">
	<h2 class="section-title">Open Source</h2>
	<p class="section-desc">Vibe es completamente open source. El código está disponible en GitHub.</p>
	<div class="oss-links">
		<a href="https://github.com/linuxer41/vibe" target="_blank" rel="noopener" class="oss-btn">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
			GitHub Repository
		</a>
	</div>
</section>

<style>
	.hero {
		position: relative; text-align: center;
		padding: 100px 24px 80px; overflow: hidden;
	}
	.hero-bg {
		position: absolute; inset: 0;
		background: radial-gradient(ellipse at 50% 0%, rgba(108,92,231,0.15) 0%, transparent 60%);
		pointer-events: none;
	}
	.hero-content { position: relative; max-width: 600px; margin: 0 auto; }
	.hero-logo { margin-bottom: 20px; }
	.hero-logo svg { filter: drop-shadow(0 0 20px rgba(108,92,231,0.4)); }
	.hero-title { font-size: 56px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 8px; }
	.hero-tagline { font-size: 20px; font-weight: 600; color: var(--accent); margin-bottom: 16px; }
	.hero-desc { font-size: 16px; color: var(--text-2); margin-bottom: 32px; line-height: 1.7; }
	.hero-cta {
		display: inline-block; padding: 14px 36px;
		background: var(--accent); color: #000; font-weight: 700;
		border-radius: var(--radius); font-size: 16px;
		transition: background 0.2s, transform 0.15s;
	}
	.hero-cta:hover { background: var(--accent-hover); transform: translateY(-1px); }

	.section { padding: 80px 24px; }
	.section-title {
		text-align: center; font-size: 32px; font-weight: 700;
		margin-bottom: 12px; letter-spacing: -0.5px;
	}
	.section-desc { text-align: center; font-size: 15px; color: var(--text-2); margin-bottom: 40px; }

	.features-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 20px; max-width: 960px; margin: 0 auto;
	}
	.feature-card {
		padding: 28px; background: var(--bg-2); border-radius: var(--radius);
		border: 1px solid var(--border); transition: border-color 0.2s;
	}
	.feature-card:hover { border-color: var(--accent); }
	.feature-icon { font-size: 32px; display: block; margin-bottom: 12px; }
	.feature-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
	.feature-card p { font-size: 14px; color: var(--text-2); line-height: 1.6; }

	.download-section { background: var(--bg-2); }
	.loading-text { text-align: center; color: var(--text-3); font-size: 14px; }
	.download-grid {
		display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 16px; max-width: 960px; margin: 0 auto 32px;
	}
	.download-card {
		display: flex; flex-direction: column; align-items: center; gap: 6px;
		padding: 28px 20px; background: var(--bg-3); border-radius: var(--radius);
		border: 1px solid var(--border); transition: all 0.2s; text-align: center;
	}
	.download-card:hover { border-color: var(--accent); transform: translateY(-2px); }
	.download-card.disabled { opacity: 0.4; pointer-events: none; }
	.dl-icon { font-size: 36px; }
	.dl-platform { font-size: 17px; font-weight: 600; }
	.dl-arch { font-size: 12px; color: var(--text-3); }
	.dl-size { font-size: 13px; color: var(--accent); font-weight: 500; }
	.dl-date { font-size: 11px; color: var(--text-3); }
	.dl-na { font-size: 12px; color: var(--text-3); font-style: italic; }

	.versions-details {
		max-width: 960px; margin: 0 auto;
	}
	.versions-details summary {
		cursor: pointer; font-size: 13px; color: var(--text-3);
		padding: 8px; text-align: center;
	}
	.versions-details summary:hover { color: var(--accent); }
	.versions-table {
		display: flex; flex-direction: column; gap: 4px;
		margin-top: 12px; padding: 12px; background: var(--bg); border-radius: var(--radius);
	}
	.version-row {
		display: grid; grid-template-columns: 1fr 1fr auto auto;
		gap: 12px; padding: 6px 8px; font-size: 12px;
	}
	.version-row:nth-child(even) { background: var(--bg-3); }
	.version-row code { color: var(--text-2); }
	.hash { font-family: monospace; color: var(--text-3); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.oss-section { text-align: center; }
	.oss-links { margin-top: 24px; }
	.oss-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 12px 24px; background: var(--bg-3); border: 1px solid var(--border);
		border-radius: var(--radius); font-size: 14px; font-weight: 500;
		transition: all 0.2s;
	}
	.oss-btn:hover { border-color: var(--accent); background: var(--bg-2); }

	@media (max-width: 600px) {
		.hero-title { font-size: 36px; }
		.hero { padding: 60px 16px 50px; }
		.section { padding: 50px 16px; }
		.download-grid { grid-template-columns: 1fr 1fr; }
		.version-row { grid-template-columns: 1fr; }
	}
</style>
