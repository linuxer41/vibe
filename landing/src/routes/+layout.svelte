<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Vibe — Chat. Watch. Live.</title>
</svelte:head>

<div class="layout">
	<nav class="nav">
		<a href="/" class="logo">
			<svg width="28" height="28" viewBox="0 0 32 32" fill="var(--accent)">
				<rect width="32" height="32" rx="8" />
				<text x="16" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#000">V</text>
			</svg>
			<span>Vibe</span>
		</a>
		<div class="nav-links">
			<a href="/#features">Características</a>
			<a href="/#download">Descargar</a>
			<a href="https://github.com/linuxer41/vibe" target="_blank" rel="noopener">GitHub</a>
		</div>
	</nav>

	<main>
		{@render children()}
	</main>

	<footer class="footer">
		<div class="footer-content">
			<div class="footer-brand">
				<svg width="24" height="24" viewBox="0 0 32 32" fill="var(--accent)">
					<rect width="32" height="32" rx="8" />
					<text x="16" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="#000">V</text>
				</svg>
				<span>Vibe</span>
			</div>
			<div class="footer-links">
				<a href="/privacy">Privacidad</a>
				<a href="/terms">Términos</a>
				<a href="https://github.com/linuxer41/vibe" target="_blank" rel="noopener">GitHub</a>
			</div>
			<p class="footer-copy">© 2026 Vibe. Open source.</p>
		</div>
	</footer>
</div>

<style>
	:global(*) { margin: 0; padding: 0; box-sizing: border-box; }
	:global(:root) {
		--bg: #0f0f0f;
		--bg-2: #1a1a1a;
		--bg-3: #252525;
		--text: #f0f0f0;
		--text-2: #aaa;
		--text-3: #666;
		--accent: #6c5ce7;
		--accent-hover: #7f6ff7;
		--border: #2a2a2a;
		--radius: 12px;
	}
	:global(html) { scroll-behavior: smooth; }
	:global(body) {
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
		background: var(--bg);
		color: var(--text);
		line-height: 1.6;
		min-height: 100vh;
	}
	a { color: inherit; text-decoration: none; }
	.layout { display: flex; flex-direction: column; min-height: 100vh; }
	main { flex: 1; }
	.nav {
		position: sticky; top: 0; z-index: 100;
		display: flex; align-items: center; justify-content: space-between;
		padding: 12px 24px; background: rgba(15,15,15,0.85);
		backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
	}
	.logo { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 700; }
	.nav-links { display: flex; gap: 24px; }
	.nav-links a { font-size: 14px; font-weight: 500; color: var(--text-2); transition: color 0.2s; }
	.nav-links a:hover { color: var(--accent); }
	.footer {
		border-top: 1px solid var(--border);
		padding: 32px 24px;
	}
	.footer-content {
		max-width: 960px; margin: 0 auto;
		display: flex; flex-direction: column; align-items: center; gap: 16px;
	}
	.footer-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; }
	.footer-links { display: flex; gap: 20px; font-size: 13px; color: var(--text-3); }
	.footer-links a:hover { color: var(--accent); }
	.footer-copy { font-size: 12px; color: var(--text-3); }
</style>
