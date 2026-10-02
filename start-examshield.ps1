param([switch]$NoDesktop)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dbPort = 5432
$probe = Test-NetConnection -ComputerName '127.0.0.1' -Port $dbPort -WarningAction SilentlyContinue
if (-not $probe.TcpTestSucceeded) {
  $pgService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running' | Select-Object -First 1
  if (-not $pgService) { throw 'PostgreSQL is not accepting connections on 127.0.0.1:5432. Start the PostgreSQL service and retry.' }
}

$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$backend = Join-Path $root 'backend'
$web = Join-Path $root 'web-panel'
function Test-ApiReady {
  try { return (Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop).StatusCode -eq 200 }
  catch { return $false }
}

$apiReady = Test-ApiReady
if (-not $apiReady) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev') -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.out.log') -RedirectStandardError (Join-Path $logs 'backend.err.log')
}
$webReady = (Test-NetConnection -ComputerName '127.0.0.1' -Port 5173 -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $webReady) {
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','dev','--','--host','127.0.0.1') -WorkingDirectory $web -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'web.out.log') -RedirectStandardError (Join-Path $logs 'web.err.log')
}

$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 2
  $apiReady = Test-ApiReady
  $webReady = (Test-NetConnection -ComputerName '127.0.0.1' -Port 5173 -WarningAction SilentlyContinue).TcpTestSucceeded
} until (($apiReady -and $webReady) -or (Get-Date) -gt $deadline)
if (-not $apiReady -or -not $webReady) { throw "Startup timed out. Inspect logs in $logs" }
Write-Host 'Backend ready at http://127.0.0.1:5000; web panel ready at http://127.0.0.1:5173/login'
if (-not $NoDesktop) {
  $exe = Join-Path $root 'dist\ExamShield.exe'
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Standalone desktop app not found. Run .\build-desktop-exe.ps1 first.' }
  Start-Process -FilePath $exe -WindowStyle Hidden
}
