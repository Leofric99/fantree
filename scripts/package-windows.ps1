param(
  [ValidateSet('nsis', 'msi', 'both', 'dir')]
  [string]$Target = 'both',
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $repoRoot

function Invoke-Npm {
  param([string[]]$Arguments)
  & npm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm command failed with exit code $LASTEXITCODE"
  }
}

if (-not $SkipBuild) {
  Invoke-Npm @('run', 'build')
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'prepare-windows-assets.ps1')
if ($LASTEXITCODE -ne 0) {
  throw "Windows installer asset preparation failed with exit code $LASTEXITCODE"
}

$builderArguments = @('exec', '--', 'electron-builder', '--win')
switch ($Target) {
  'nsis' { $builderArguments += 'nsis' }
  'msi' { $builderArguments += 'msi' }
  'dir' { $builderArguments += 'dir' }
  'both' {
    $builderArguments += 'nsis'
    $builderArguments += '--win'
    $builderArguments += 'msi'
  }
}

Invoke-Npm $builderArguments

Write-Host "Windows package completed. See the release directory for the $Target artifact(s)." -ForegroundColor Green
