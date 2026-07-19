[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$BackupFile,
  [string]$ComposeFile = 'docker-compose.production.yml',
  [string]$EnvFile = '.env.production'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'docker no está disponible.'
}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
  throw "No existe $EnvFile."
}
if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf) -or (Get-Item -LiteralPath $BackupFile).Length -eq 0) {
  throw "Backup inexistente o vacío: $BackupFile"
}

$confirmation = Read-Host 'Esta restauración reemplazará la base actual. Escribe RESTAURAR para continuar'
if ($confirmation -cne 'RESTAURAR') {
  throw 'Restauración cancelada.'
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$containerFile = "/tmp/yommigo-restore-$timestamp.dump"

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --env-file $EnvFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose falló con código $LASTEXITCODE."
  }
}

try {
  Invoke-Compose cp $BackupFile "postgres:$containerFile"
  Invoke-Compose exec -T postgres sh -eu -c 'pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$1"' restore $containerFile
  Write-Host "Restauración completada desde: $BackupFile"
}
finally {
  & docker compose --env-file $EnvFile -f $ComposeFile exec -T postgres rm -f $containerFile *> $null
}
