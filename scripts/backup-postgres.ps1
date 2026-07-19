[CmdletBinding()]
param(
  [string]$ComposeFile = 'docker-compose.production.yml',
  [string]$EnvFile = '.env.production',
  [string]$BackupDirectory = 'backups'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'docker no está disponible.'
}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
  throw "No existe $EnvFile."
}

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$backupFile = Join-Path $BackupDirectory "yommigo-$timestamp.dump"
$containerFile = "/tmp/yommigo-$timestamp.dump"

if (Test-Path -LiteralPath $backupFile) {
  throw "El backup ya existe: $backupFile"
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose falló con código $LASTEXITCODE."
  }
}

try {
  Invoke-Compose exec -T postgres sh -eu -c 'pg_dump --format=custom --no-owner --no-privileges --file "$1" --username "$POSTGRES_USER" "$POSTGRES_DB"' backup $containerFile
  Invoke-Compose cp "postgres:$containerFile" $backupFile

  if (-not (Test-Path -LiteralPath $backupFile -PathType Leaf) -or (Get-Item -LiteralPath $backupFile).Length -eq 0) {
    throw 'El archivo de backup está vacío.'
  }

  Write-Host "Backup creado: $backupFile"
}
finally {
  & docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres rm -f $containerFile *> $null
}
