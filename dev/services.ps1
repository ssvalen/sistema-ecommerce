# PostgreSQL 16 y Redis 7 en Podman, solo para desarrollo. Requiere dev/dev.env.
# Uso: .\dev\services.ps1 up | down | reset | status
# Solo ASCII: PowerShell 5.1 lee mal UTF-8 sin BOM.
param(
  [Parameter(Position = 0)]
  [ValidateSet('up', 'down', 'reset', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$DevDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $DevDir
$EnvFile = Join-Path $DevDir 'dev.env'
$RuntimeDir = Join-Path $DevDir '.runtime'

$Network = 'sistema-e-dev'
$PgContainer = 'sistema-e-postgres'
$PgVolume = 'sistema-e-pgdata'
$PgImage = 'docker.io/library/postgres:16'
$RedisContainer = 'sistema-e-redis'
$RedisImage = 'docker.io/library/redis:7'

function Read-DevEnv {
  if (-not (Test-Path $EnvFile)) {
    throw 'Falta dev/dev.env. Copia dev/dev.env.example como dev/dev.env.'
  }
  $values = @{}
  foreach ($line in Get-Content $EnvFile) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
      $values[$Matches[1]] = $Matches[2].Trim()
    }
  }
  $required = 'POSTGRES_SUPERUSER_PASSWORD', 'DB_OWNER_PASSWORD', 'DB_APP_PASSWORD',
  'REDIS_ADMIN_PASSWORD', 'REDIS_APP_PASSWORD'
  foreach ($key in $required) {
    if (-not $values[$key]) { throw "Falta $key en dev/dev.env" }
  }
  if (-not $values['DEV_PG_PORT']) { $values['DEV_PG_PORT'] = '5432' }
  if (-not $values['DEV_REDIS_PORT']) { $values['DEV_REDIS_PORT'] = '6379' }
  return $values
}

# No imprime los argumentos: incluyen contrasenas.
function Invoke-Podman {
  & podman @args
  if ($LASTEXITCODE -ne 0) {
    throw "podman $($args[0]) fallo (codigo $LASTEXITCODE)"
  }
}

function Test-PodmanObject([string]$Kind, [string]$Name) {
  & podman $Kind exists $Name 2>$null
  return ($LASTEXITCODE -eq 0)
}

function Get-Sha256Hex([string]$Text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
  }
  finally {
    $sha.Dispose()
  }
}

# UTF-8 sin BOM y LF (Redis).
function Write-LfFile([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content.Replace("`r`n", "`n"))
}

function Write-RedisConfig($cfg) {
  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

  $template = Get-Content (Join-Path $RepoRoot 'deploy\cache\redis\users.acl.tpl') -Raw
  $acl = $template.
  Replace('__REDIS_ADMIN_PASSWORD_SHA256__', (Get-Sha256Hex $cfg['REDIS_ADMIN_PASSWORD'])).
  Replace('__REDIS_APP_PASSWORD_SHA256__', (Get-Sha256Hex $cfg['REDIS_APP_PASSWORD']))
  Write-LfFile (Join-Path $RuntimeDir 'users.acl') $acl

  $conf = @(
    'aclfile /usr/local/etc/redis/users.acl'
    'save ""'
    'appendonly no'
    'maxmemory 128mb'
    'maxmemory-policy allkeys-lru'
  ) -join "`n"
  Write-LfFile (Join-Path $RuntimeDir 'redis.conf') ($conf + "`n")
}

function Wait-Postgres {
  Write-Host 'Esperando a PostgreSQL...'
  for ($i = 0; $i -lt 60; $i++) {
    # Por TCP: el servidor temporal de inicializacion solo escucha por socket.
    & podman exec $PgContainer pg_isready -h 127.0.0.1 -U postgres -d ecommerce 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'PostgreSQL listo.'
      return
    }
    Start-Sleep -Seconds 1
  }
  throw 'PostgreSQL no respondio a tiempo. Revisa: podman logs sistema-e-postgres'
}

function Start-Services {
  $cfg = Read-DevEnv

  if (-not (Test-PodmanObject 'network' $Network)) { Invoke-Podman network create $Network | Out-Null }
  if (-not (Test-PodmanObject 'volume' $PgVolume)) { Invoke-Podman volume create $PgVolume | Out-Null }

  if (Test-PodmanObject 'container' $PgContainer) {
    Invoke-Podman start $PgContainer | Out-Null
  }
  else {
    $rolesDir = Join-Path $RepoRoot 'deploy\db\postgresql'
    $initDir = Join-Path $DevDir 'postgres-init'
    Invoke-Podman run -d --name $PgContainer --network $Network `
      -p "127.0.0.1:$($cfg['DEV_PG_PORT']):5432" `
      -e "POSTGRES_PASSWORD=$($cfg['POSTGRES_SUPERUSER_PASSWORD'])" `
      -e "DB_OWNER_PASSWORD=$($cfg['DB_OWNER_PASSWORD'])" `
      -e "DB_APP_PASSWORD=$($cfg['DB_APP_PASSWORD'])" `
      -v "${PgVolume}:/var/lib/postgresql/data" `
      -v "${rolesDir}:/deploy-db:ro" `
      -v "${initDir}:/docker-entrypoint-initdb.d:ro" `
      $PgImage | Out-Null
  }

  # Sin datos persistentes: se recrea para tomar la configuracion actual.
  Write-RedisConfig $cfg
  if (Test-PodmanObject 'container' $RedisContainer) { Invoke-Podman rm -f $RedisContainer | Out-Null }
  $aclFile = Join-Path $RuntimeDir 'users.acl'
  $confFile = Join-Path $RuntimeDir 'redis.conf'
  Invoke-Podman run -d --name $RedisContainer --network $Network `
    -p "127.0.0.1:$($cfg['DEV_REDIS_PORT']):6379" `
    -v "${aclFile}:/usr/local/etc/redis/users.acl:ro" `
    -v "${confFile}:/usr/local/etc/redis/redis.conf:ro" `
    $RedisImage redis-server /usr/local/etc/redis/redis.conf | Out-Null

  Wait-Postgres
  Show-Status
}

function Stop-Services {
  foreach ($name in $PgContainer, $RedisContainer) {
    if (Test-PodmanObject 'container' $name) { Invoke-Podman stop $name | Out-Null }
  }
  Show-Status
}

function Reset-Services {
  foreach ($name in $PgContainer, $RedisContainer) {
    if (Test-PodmanObject 'container' $name) { Invoke-Podman rm -f $name | Out-Null }
  }
  if (Test-PodmanObject 'volume' $PgVolume) { Invoke-Podman volume rm $PgVolume | Out-Null }
  Write-Host 'Servicios y datos de desarrollo eliminados.'
}

function Show-Status {
  & podman ps -a --filter 'name=sistema-e-' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

switch ($Action) {
  'up' { Start-Services }
  'down' { Stop-Services }
  'reset' { Reset-Services }
  'status' { Show-Status }
}
