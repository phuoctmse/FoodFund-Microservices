param(
  [string]$namespace = "foodfund-staging",
  [string]$userDatabaseUrl = $env:USER_DATABASE_URL,
  [string]$dbHost = $env:DATABASE_HOST,
  [string]$dbPort = $env:DATABASE_PORT,
  [string]$dbUser = $env:DATABASE_USERNAME,
  [string]$dbPassword = $env:DATABASE_PASSWORD,
  [string]$dbSslMode = $env:DATABASE_SSL_MODE
)

if (-not $userDatabaseUrl -or -not $dbHost -or -not $dbPort -or -not $dbUser -or -not $dbPassword) {
  Write-Error "Missing required environment variables. Please set USER_DATABASE_URL, DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME and DATABASE_PASSWORD."
  exit 1
}

function To-Base64($s) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
  return [Convert]::ToBase64String($bytes)
}

$secretTemplate = Get-Content -Raw "$PSScriptRoot/secret.yaml"
$secretTemplate = $secretTemplate -replace 'REPLACE_USER_DATABASE_URL_BASE64', (To-Base64 $userDatabaseUrl)
$secretTemplate = $secretTemplate -replace 'REPLACE_DATABASE_HOST_BASE64', (To-Base64 $dbHost)
$secretTemplate = $secretTemplate -replace 'REPLACE_DATABASE_PORT_BASE64', (To-Base64 $dbPort)
$secretTemplate = $secretTemplate -replace 'REPLACE_DATABASE_USERNAME_BASE64', (To-Base64 $dbUser)
$secretTemplate = $secretTemplate -replace 'REPLACE_DATABASE_PASSWORD_BASE64', (To-Base64 $dbPassword)
$secretTemplate = $secretTemplate -replace 'REPLACE_DATABASE_SSL_MODE_BASE64', (To-Base64 ($dbSslMode -or 'require'))

$secretTemplate | kubectl apply -f -

kubectl apply -f "$PSScriptRoot/namespace.yaml"
kubectl apply -f "$PSScriptRoot/services.yaml"
kubectl apply -f "$PSScriptRoot/auth-deployment.yaml"
kubectl apply -f "$PSScriptRoot/user-deployment.yaml"
kubectl apply -f "$PSScriptRoot/gateway-deployment.yaml"

Write-Host "Applied manifests to namespace $namespace."
