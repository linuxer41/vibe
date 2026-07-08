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
    # Merge all *_generated.rs into one vibe_generated.rs
    # Structure: keep first file's vibe opening, then append all sub-modules,
    # then close vibe once
    $rsFiles = Get-ChildItem $outRs -Filter "*_generated.rs" | Sort-Object Name
    $header = $null        # first file: everything up to and including "pub mod vibe {"
    $body = @()            # content from all files inside vibe { ... }
    $vibeClose = "}  // pub mod Vibe"
    $first = $true
    foreach ($f in $rsFiles) {
        $lines = Get-Content $f.FullName
        if ($first) {
            # Split first file at the vibe closing brace
            $splitAt = -1
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match '// pub mod Vibe') { $splitAt = $i; break }
            }
            if ($splitAt -ge 0) {
                $header = $lines[0..$splitAt]   # includes "}  // pub mod Vibe" (we'll replace)
            } else {
                $header = $lines
            }
            $first = $false
        } else {
            # Extract content between "pub mod vibe {" and "}  // pub mod Vibe"
            $start = 0
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match 'pub mod vibe ') { $start = $i; break }  # keep the opening line itself? No, skip it
            }
            if ($start -gt 0) { $start++ } # skip past `pub mod vibe {`
            $end = $lines.Count - 1
            for ($i = $lines.Count - 1; $i -ge 0; $i--) {
                if ($lines[$i] -match '// pub mod Vibe') { $end = $i - 1; break }
            }
            if ($start -le $end) {
                $body += $lines[$start..$end]
            }
        }
    }
    # Assemble: header (without the closing }) + body + closing }
    if ($header) {
        # Remove last line (the closing "}  // pub mod Vibe") from header
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

# Backend Rust (merged vibe_generated.rs)
$mergedFile = Join-Path $outRs "vibe_generated.rs"
if (Test-Path $mergedFile) {
    $beRsGen = Join-Path $root "..\backend-rust\src\generated"
    New-Item -ItemType Directory -Path $beRsGen -Force | Out-Null
    Copy-Item -Path $mergedFile -Destination (Join-Path $beRsGen "vibe_generated.rs") -Force
    Write-Host "  => Backend Rust: $beRsGen\vibe_generated.rs"
} else {
    Write-Warning "  => vibe_generated.rs not found, skipping backend-rust copy"
}

# Tauri (Rust) — same vibe_generated.rs
if (Test-Path $mergedFile) {
    $tauriGen = Join-Path $root "..\frontend\src-tauri\src\generated"
    New-Item -ItemType Directory -Path $tauriGen -Force | Out-Null
    Copy-Item -Path $mergedFile -Destination (Join-Path $tauriGen "vibe_generated.rs") -Force
    Write-Host "  => Tauri Rust: $tauriGen\vibe_generated.rs"
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
