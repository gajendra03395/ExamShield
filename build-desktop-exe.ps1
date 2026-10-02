$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot 'desktop-client\SecureExam\SecureExam.csproj'
$output = Join-Path $PSScriptRoot 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
dotnet publish $project -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -o $output
if ($LASTEXITCODE -ne 0) { throw "Desktop publish failed with exit code $LASTEXITCODE" }
$target = Join-Path $output 'ExamShield.exe'
if (-not (Test-Path -LiteralPath $target)) { throw "Publish output not found: $target" }
Write-Host "Published standalone kiosk: $target"
