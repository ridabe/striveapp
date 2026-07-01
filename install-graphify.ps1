# Script de instalação do Graphify para Claude Code

# Encontrar Python instalado
$pythonExe = $null

$candidates = @(
    "C:\Users\ridab\AppData\Local\Programs\Python\Python314\python.exe",
    "C:\Users\ridab\AppData\Local\Programs\Python\Python313\python.exe",
    "C:\Program Files\Python314\python.exe",
    "C:\Program Files\Python313\python.exe"
)

foreach ($c in $candidates) {
    if (Test-Path $c) {
        $pythonExe = $c
        break
    }
}

if (-not $pythonExe) {
    # Tenta buscar automaticamente
    $found = Get-ChildItem "C:\Users\ridab\AppData\Local\Programs\Python" -Filter "python.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $pythonExe = $found.FullName }
}

if (-not $pythonExe) {
    Write-Host "Python nao encontrado. Informe o caminho:" -ForegroundColor Red
    $pythonExe = Read-Host "Caminho do python.exe"
}

Write-Host "Usando Python: $pythonExe" -ForegroundColor Cyan
Write-Host "Instalando graphify..." -ForegroundColor Cyan

& $pythonExe -m pip install graphifyy

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nRegistrando skill no Claude Code..." -ForegroundColor Cyan
    & $pythonExe -m graphify install
    Write-Host "`nGraphify instalado com sucesso!" -ForegroundColor Green
    Write-Host "Abra qualquer projeto no Claude Code e digite: /graphify ." -ForegroundColor Yellow
} else {
    Write-Host "Erro ao instalar." -ForegroundColor Red
}
