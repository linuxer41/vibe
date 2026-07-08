$flatc = if (Get-Command flatc -ErrorAction SilentlyContinue) { "flatc" } else { "$env:LOCALAPPDATA\flatc\flatc.exe" }
$root = Split-Path $PSCommandPath
$outTs = Join-Path $root "..\generated\ts"
$outRs = Join-Path $root "..\generated\rs\src"
$outJs = Join-Path $root "..\generated\js"
$fbsFiles = Join-Path $root "*.fbs"

Write-Host "Generating TypeScript..."
& $flatc --ts -o $outTs $fbsFiles

Write-Host "Generating Rust..."
& $flatc --rust -o $outRs $fbsFiles

# Copy TS to frontend
$feFb = Join-Path $root "..\..\frontend\src\lib\fb"
if (Test-Path $feFb) { Remove-Item -Recurse -Force $feFb }
Copy-Item -Recurse -Path $outTs -Destination $feFb
Write-Host "Copiado a frontend: $feFb"

# Compile TS to JS for backend
if (Get-Command npx -ErrorAction SilentlyContinue) {
  Write-Host "Compilando JavaScript..."
  $tsFiles = Get-ChildItem -Path $outTs -Recurse -Filter "*.ts"
  foreach ($file in $tsFiles) {
    $rel = $file.FullName.Substring($outTs.Length + 1)
    $out = Join-Path $outJs ($rel -replace '\.ts$', '.js')
    $outDir = Split-Path -Parent $out
    if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    $null = & npx esbuild $file.FullName --outfile=$out --format=esm --packages=external 2>&1
  }
  Write-Host "JavaScript generado: $outJs"

  $beFb = Join-Path $root "..\..\backend-node\fb"
  if (Test-Path $beFb) { Remove-Item -Recurse -Force $beFb }
  Copy-Item -Recurse -Path $outJs -Destination $beFb
  Write-Host "Copiado a backend: $beFb"
} else {
  Write-Host "npx no encontrado, omitiendo compilación JS"
}

# Copy Rust to backend-rust
$beRsFb = Join-Path $root "..\..\backend-rust\src\fb"
if (Test-Path $beRsFb) { Remove-Item -Recurse -Force $beRsFb }
New-Item -ItemType Directory -Path $beRsFb -Force | Out-Null
Copy-Item -Recurse -Path "$outRs\*" -Destination $beRsFb
Write-Host "Copiado a backend-rust: $beRsFb"

# Copy Rust to tauri-src
$tauriFb = Join-Path $root "..\..\frontend\src-tauri\src\fb"
if (Test-Path $tauriFb) { Remove-Item -Recurse -Force $tauriFb }
New-Item -ItemType Directory -Path $tauriFb -Force | Out-Null
Copy-Item -Recurse -Path "$outRs\*" -Destination $tauriFb
Write-Host "Copiado a tauri-src: $tauriFb"

Write-Host "Hecho"