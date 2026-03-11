# Netlify API deploy fallback skeleton
# Kullanım: PowerShell içinde repo kökünde çalıştırın.
# Not: Token değeri loglanmaz, sadece isim/uzunluk ve HTTP durumları yazılır.

$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot '.env'
if (!(Test-Path $envFile)) {
  Write-Host '.env bulunamadı'; exit 1
}

# .env yükle (sadece bu dosya)
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#') { return }
  if ($_ -match '^\s*$') { return }
  $name, $value = $_ -split '=', 2
  if ($name -and $value) {
    $value = $value.Trim().Trim('"')
    [System.Environment]::SetEnvironmentVariable($name.Trim(), $value, 'Process')
  }
}

$siteId = $env:NETLIFY_SITE_ID
$tokenVars = @('NETLIFY_AUTH_TOKEN','NETLIFY_AUTH_TOKEN_1','NETLIFY_AUTH_TOKEN_2','NETLIFY_AUTH_TOKEN_FALLBACK')

if ([string]::IsNullOrWhiteSpace($siteId)) {
  Write-Host 'NETLIFY_SITE_ID boş'; exit 1
}

# En umutlu token: ilk dolu token
$selectedName = $null
$selectedToken = $null
foreach ($name in $tokenVars) {
  $val = [System.Environment]::GetEnvironmentVariable($name, 'Process')
  Write-Host ("{0}: present={1}, len={2}" -f $name, (![string]::IsNullOrWhiteSpace($val)), ($val ?? '').Length)
  if (-not $selectedToken -and -not [string]::IsNullOrWhiteSpace($val)) {
    $selectedName = $name
    $selectedToken = $val
  }
}

if (-not $selectedToken) {
  Write-Host 'Kullanılabilir token bulunamadı'; exit 1
}

Write-Host ("Seçilen token: {0}" -f $selectedName)

$headers = @{ Authorization = "Bearer $selectedToken" }

# 1) Kimlik ve site erişimi kontrolü
try {
  $userResp = Invoke-RestMethod -Uri 'https://api.netlify.com/api/v1/user' -Headers $headers -Method Get
  Write-Host 'GET /user: OK'
} catch {
  Write-Host ("GET /user: FAIL -> {0}" -f $_.Exception.Message)
}

try {
  $siteResp = Invoke-RestMethod -Uri ("https://api.netlify.com/api/v1/sites/{0}" -f $siteId) -Headers $headers -Method Get
  Write-Host 'GET /sites/{site_id}: OK'
} catch {
  Write-Host ("GET /sites/{site_id}: FAIL -> {0}" -f $_.Exception.Message)
}

# 2) Deploy başlatma (skeleton)
# Gerçek deploy için dosya hash manifesti + upload istekleri gerekir.
# Bu script sadece iskelet başlangıcı sağlar.
$deployBody = @{ title = "fallback-api-deploy-$(Get-Date -Format s)" } | ConvertTo-Json

try {
  $deployResp = Invoke-RestMethod -Uri ("https://api.netlify.com/api/v1/sites/{0}/deploys" -f $siteId) -Headers ($headers + @{ 'Content-Type' = 'application/json' }) -Method Post -Body $deployBody
  Write-Host 'POST /deploys: OK'
  Write-Host ("deploy_id={0}" -f $deployResp.id)
  if ($deployResp.ssl_url) { Write-Host ("production_url={0}" -f $deployResp.ssl_url) }
} catch {
  Write-Host ("POST /deploys: FAIL -> {0}" -f $_.Exception.Message)
}

Write-Host 'Bitti. Gerekirse bir sonraki adım: manifest + dosya upload akışını eklemek.'
