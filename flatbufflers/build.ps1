# Vibe FlatBuffers Build Script
# Generates TS, Rust (merged), JS (from TS), and Go from flatbufflers/schema/*.fbs
# Target flatc version: 25.12.19

$ErrorActionPreference = "Continue"
$flatc = if (Get-Command flatc -ErrorAction SilentlyContinue) { "flatc" } else { "$env:LOCALAPPDATA\flatc\flatc.exe" }
$root = Split-Path $PSCommandPath
$schemaDir = Join-Path $root "schema"
$outTs = Join-Path $root "generated\ts"
$outJs = Join-Path $root "generated\js"
$outGo = Join-Path $root "generated\go"
$outRs = Join-Path $root "generated\rs"
$fbsFiles = @(Get-ChildItem $schemaDir -Filter "*.fbs" | ForEach-Object { $_.FullName })

Write-Host "=== Vibe FlatBuffers Build ==="

# Clean all output dirs
foreach ($d in @($outTs, $outJs, $outGo, $outRs)) {
    if (Test-Path $d) { Remove-Item -Recurse -Force $d -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $d -Force | Out-Null
}

# ── 1. TypeScript ──
Write-Host "`n[1/4] TypeScript..."
& $flatc --ts -o $outTs $fbsFiles 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    $count = @(Get-ChildItem $outTs -Recurse -File).Count
    Write-Host "  => $count files in $outTs"
} else {
    Write-Warning "  => TS generation failed (exit $LASTEXITCODE)"
}

# ── 2. Rust (merged into single vibe_generated.rs) ──
Write-Host "[2/4] Rust..."
& $flatc --rust -o $outRs $fbsFiles 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    $rsFiles = Get-ChildItem $outRs -Filter "*_generated.rs" | Sort-Object Name
    $header = $null
    $body = @()
    $vibeClose = "}  // pub mod Vibe"
    $first = $true
    foreach ($f in $rsFiles) {
        $lines = Get-Content $f.FullName
        # Strip extern crate alloc (duplicated per-file)
        $lines = $lines | Where-Object { $_ -notmatch '^\s*extern crate alloc;' }
        if ($first) {
            $splitAt = -1
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '\A\}  // pub mod Vibe') { $splitAt = $i; break }
            }
            if ($splitAt -ge 0) {
                $header = $lines[0..$splitAt]
            } else {
                $header = $lines
            }
            $first = $false
        } else {
            $start = 0
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match 'pub mod vibe ') { $start = $i; break }
            }
            if ($start -gt 0) { $start++ }
            $end = $lines.Count - 1
            for ($i = $lines.Count - 1; $i -ge 0; $i--) {
                if ($lines[$i] -match '\A\}  // pub mod Vibe') { $end = $i - 1; break }
            }
            if ($start -le $end) {
                $body += $lines[$start..$end]
            }
        }
    }
    if ($header) {
        $hdrLen = $header.Count
        $final = $header[0..($hdrLen - 2)]
        $final += $body
        $final += $vibeClose
        $mergedFile = Join-Path $outRs "vibe_generated.rs"
        $final -join "`r`n" | Set-Content $mergedFile -NoNewline
        Write-Host "  => merged $(@($rsFiles).Count) files into $mergedFile ($(@($final).Count) lines)"
    } else {
        Write-Warning "  => could not parse first file for vibe module boundary"
    }
} else {
    Write-Warning "  => Rust generation failed (exit $LASTEXITCODE)"
}

# ── 3. JavaScript (compile TS → ESM JS for Node.js backend) ──
Write-Host "[3/4] JavaScript..."
if (Get-Command npx -ErrorAction SilentlyContinue) {
    $tsFiles = Get-ChildItem -Path $outTs -Recurse -Filter "*.ts"
    foreach ($file in $tsFiles) {
        $rel = $file.FullName.Substring($outTs.Length + 1)
        $out = Join-Path $outJs ($rel -replace '\.ts$', '.js')
        $outDir = Split-Path -Parent $out
        if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
        $null = & npx esbuild $file.FullName --outfile=$out --format=esm --packages=external 2>&1
    }
    Write-Host "  => JS compiled: $(@($tsFiles).Count) files -> $outJs"
} else {
    Write-Warning "  => npx not found, skipping JS compilation"
}

# ── 4. Go ──
Write-Host "[4/4] Go..."
& $flatc --go --go-module-name vibe -o $outGo $fbsFiles 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    $count = @(Get-ChildItem $outGo -Recurse -File).Count
    Write-Host "  => $count files in $outGo"
} else {
    Write-Warning "  => Go generation failed (exit $LASTEXITCODE)"
}

# ── Copy to destinations ──
Write-Host "`n=== Copying to destinations ==="

# Frontend (TypeScript)
$feFb = Join-Path $root "..\frontend\src\lib\fb"
if (Test-Path $feFb) { Remove-Item -Recurse -Force $feFb }
New-Item -ItemType Directory -Path $feFb -Force | Out-Null
Copy-Item -Recurse -Path "$outTs\*" -Destination $feFb
Write-Host "  => Frontend TS: $feFb"

# Backend (JavaScript)
if (Test-Path $outJs) {
    $beFb = Join-Path $root "..\backend-node\fb"
    if (Test-Path $beFb) { Remove-Item -Recurse -Force $beFb }
    New-Item -ItemType Directory -Path $beFb -Force | Out-Null
    Copy-Item -Recurse -Path "$outJs\*" -Destination $beFb
    Write-Host "  => Backend JS: $beFb"
} else {
    Write-Warning "  => Skipping backend JS copy (JS not generated)"
}

# Backend Rust (merged vibe_generated.rs into fb/)
$mergedFile = Join-Path $outRs "vibe_generated.rs"
if (Test-Path $mergedFile) {
    $beRsFb = Join-Path $root "..\backend-rust\fb"
    if (Test-Path $beRsFb) { Remove-Item -Recurse -Force $beRsFb }
    New-Item -ItemType Directory -Path $beRsFb -Force | Out-Null
    Copy-Item -Path $mergedFile -Destination (Join-Path $beRsFb "vibe_generated.rs") -Force
    Write-Host "  => Backend Rust: $beRsFb\vibe_generated.rs"
} else {
    Write-Warning "  => vibe_generated.rs not found, skipping backend-rust copy"
}

# Tauri (Rust) — same vibe_generated.rs into src-tauri/fb/
if (Test-Path $mergedFile) {
    $tauriFb = Join-Path $root "..\frontend\src-tauri\fb"
    if (Test-Path $tauriFb) { Remove-Item -Recurse -Force $tauriFb }
    New-Item -ItemType Directory -Path $tauriFb -Force | Out-Null
    Copy-Item -Path $mergedFile -Destination (Join-Path $tauriFb "vibe_generated.rs") -Force
    Write-Host "  => Tauri Rust: $tauriFb\vibe_generated.rs"
} else {
    Write-Warning "  => vibe_generated.rs not found, skipping tauri copy"
}

# Go
if (Test-Path $outGo) {
    $goDest = Join-Path $root "..\backend-go\fb"
    if (Test-Path $goDest) { Remove-Item -Recurse -Force $goDest }
    New-Item -ItemType Directory -Path $goDest -Force | Out-Null
    Copy-Item -Recurse -Path "$outGo\*" -Destination $goDest
    Write-Host "  => Go: $goDest"
} else {
    Write-Warning "  => Go output not found, skipping copy"
}

Write-Host "`n=== Build complete ==="
