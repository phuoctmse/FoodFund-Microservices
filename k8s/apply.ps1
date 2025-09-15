param(
  [string]$namespace = "foodfund-staging",
  [string]$userDatabaseUrl = $env:USER_DATABASE_URL,
  [string]$dbHost = $env:DATABASE_HOST,
  [string]$dbPort = $env:DATABASE_PORT,
  [string]$dbUser = $env:DATABASE_USERNAME,
  [string]$dbPassword = $env:DATABASE_PASSWORD,
  [string]$dbSslMode = $env:DATABASE_SSL_MODE,
  [string]$databaseName = $env:DATABASE_NAME,
  [string]$databases = $env:DATABASES,
  [string]$singleDatabase = $env:DATABASE,
  [string]$authImage = $env:AUTH_IMAGE,
  [string]$userImage = $env:USER_IMAGE,
  [string]$gatewayImage = $env:GATEWAY_IMAGE
)

# If full URL is not provided, build it from components
if (-not $userDatabaseUrl) {
  if (-not $dbHost -or -not $dbPort -or -not $dbUser -or -not $dbPassword) {
    Write-Error "Missing required environment variables. Please set USER_DATABASE_URL or set DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME and DATABASE_PASSWORD."
    exit 1
  }
  # Prefer an explicit DATABASE_NAME (or USER_DATABASE_NAME) if provided, otherwise default to 'users_db'
  if (-not $databaseName) { $databaseName = $env:USER_DATABASE_NAME }
  if (-not $databaseName) { $databaseName = 'users_db' }
  $userDatabaseUrl = "postgresql://$dbUser:$dbPassword@$dbHost:$dbPort/$databaseName?sslmode=$($dbSslMode -or 'require')"
}

function To-Base64($s) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($s)
  return [Convert]::ToBase64String($bytes)
}

# Ensure a connection string has sslmode set (useful for DigitalOcean managed databases)
function Ensure-SslMode($url) {
  if (-not $url) { return $url }
  if ($url -match '(?i)sslmode=') { return $url }
  if ($url -match '\?') { return "$url&sslmode=require" }
  return "$url?sslmode=require"
}

# If KUBE_CONFIG_DATA isn't provided, but DigitalOcean token+cluster name are,
# fetch the cluster kubeconfig from DigitalOcean's API and set KUBECONFIG to a temp file.
function Use-DigitalOceanKubeconfig($token, $clusterName) {
  if (-not $token -or -not $clusterName) { return $null }
  try {
    $base = 'https://api.digitalocean.com/v2/kubernetes/clusters'
    # List clusters and find by name
    $resp = Invoke-RestMethod -Method Get -Uri "$base?per_page=200" -Headers @{ Authorization = "Bearer $token" }
    $clusters = $resp.kubernetes_clusters
    if (-not $clusters) { Write-Error "No clusters returned from DigitalOcean API."; return $null }
    $cluster = $clusters | Where-Object { $_.name -eq $clusterName } | Select-Object -First 1
    if (-not $cluster) { Write-Error "DigitalOcean cluster named '$clusterName' not found."; return $null }
    $id = $cluster.id
    # Fetch kubeconfig YAML
    $kubeYaml = Invoke-RestMethod -Method Get -Uri "$base/$id/kubeconfig" -Headers @{ Authorization = "Bearer $token" }
    if (-not $kubeYaml) { Write-Error "Failed to retrieve kubeconfig for cluster id $id"; return $null }
    $tmp = Join-Path $env:TEMP "kubeconfig-foodfund-$([guid]::NewGuid().ToString()).yaml"
    Set-Content -Path $tmp -Value $kubeYaml -Encoding UTF8
    # Set environment for kubectl in this process
    $env:KUBECONFIG = $tmp
    Write-Host "Using DigitalOcean kubeconfig from cluster '$clusterName' (id: $id) -> $tmp"
    return $tmp
  } catch {
    Write-Error "Error fetching kubeconfig from DigitalOcean: $($_.Exception.Message)"
    return $null
  }
}

# If KUBE_CONFIG_DATA is present (base64), write it to a temp file and set KUBECONFIG.
if (-not $env:KUBECONFIG -and $env:KUBE_CONFIG_DATA) {
  try {
    $kcfg = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:KUBE_CONFIG_DATA))
    $tmp = Join-Path $env:TEMP "kubeconfig-foodfund-$([guid]::NewGuid().ToString()).yaml"
    Set-Content -Path $tmp -Value $kcfg -Encoding UTF8
    $env:KUBECONFIG = $tmp
    Write-Host "Wrote KUBE_CONFIG_DATA to $tmp and set KUBECONFIG"
  } catch {
    Write-Warning "Failed to decode KUBE_CONFIG_DATA: $($_.Exception.Message)"
  }
}

# If still no KUBECONFIG env var, but DigitalOcean token + cluster name exist, try to fetch kubeconfig
if (-not $env:KUBECONFIG -and $env:DIGITALOCEON_ACCESS_TOKEN -and $env:DIGITALOCEON_CLUSTER_NAME) {
  Use-DigitalOceanKubeconfig -token $env:DIGITALOCEON_ACCESS_TOKEN -clusterName $env:DIGITALOCEON_CLUSTER_NAME | Out-Null
}

# Build secret manifest dynamically.
# Preferred: a simple single GitHub secret named `DATABASES` with this format:
# "users=postgresql://user:pass@host:5432/users_db?sslmode=require;campaigns=postgresql://..."
# It is human-editable and avoids JSON quoting in the Actions UI. If DATABASES is not
# present, fall back to legacy single-DB behavior using USER_DATABASE_URL or component env vars.
# allow passing a single plain DATABASE or DATABASE_URL environment variable (preferred by user)
$databases = $databases
$singleDatabase = $singleDatabase -or $env:DATABASE_URL

$dataEntries = @{}
if ($databases) {
  # Parse semi-colon separated key=value pairs. Allow comma or newline as separators too.
  $pairs = $databases -split '[;,
]'
  foreach ($p in $pairs) {
    $trim = $p.Trim()
    if (-not $trim) { continue }
    if ($trim -notmatch '=') { Write-Warning "Skipping invalid database entry: '$trim' (expected name=url)"; continue }
    $parts = $trim -split '=',2
    $name = $parts[0].Trim()
    $url = $parts[1].Trim()
    if (-not $name -or -not $url) { Write-Warning "Skipping invalid database entry: '$trim'"; continue }
    $key = "${name}-database-url"
    $dataEntries[$key] = To-Base64 $url
  }
} else {
  # If the user provided a single DATABASE (or DATABASE_URL) secret, use that directly.
  if ($singleDatabase) {
    $url = Ensure-SslMode $singleDatabase
    $dataEntries['user-database-url'] = To-Base64 $url
  } else {
    # Backwards-compatible single DB behavior (build from components)
    if (-not $userDatabaseUrl) {
      if (-not $dbHost -or -not $dbPort -or -not $dbUser -or -not $dbPassword) {
        Write-Error "Missing required environment variables. Please set USER_DATABASE_URL or set DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME and DATABASE_PASSWORD."
        exit 1
      }
      if (-not $databaseName) { $databaseName = $env:USER_DATABASE_NAME }
      if (-not $databaseName) { $databaseName = 'users_db' }
      $userDatabaseUrl = "postgresql://$dbUser:$dbPassword@$dbHost:$dbPort/$databaseName?sslmode=$($dbSslMode -or 'require')"
    }
    # populate legacy keys
    $dataEntries['user-database-url'] = To-Base64 $userDatabaseUrl
    if ($dbHost) { $dataEntries['database-host'] = To-Base64 $dbHost }
    if ($dbPort) { $dataEntries['database-port'] = To-Base64 $dbPort }
    if ($dbUser) { $dataEntries['database-username'] = To-Base64 $dbUser }
    if ($dbPassword) { $dataEntries['database-password'] = To-Base64 $dbPassword }
    $dataEntries['database-ssl-mode'] = To-Base64 ($dbSslMode -or 'require')
  }
}

# Build YAML for the secret
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("apiVersion: v1")
[void]$sb.AppendLine("kind: Secret")
[void]$sb.AppendLine("metadata:")
[void]$sb.AppendLine("  name: foodfund-database-secret")
[void]$sb.AppendLine("  namespace: $namespace")
[void]$sb.AppendLine("type: Opaque")
[void]$sb.AppendLine("data:")
foreach ($k in $dataEntries.Keys) {
  $v = $dataEntries[$k]
  [void]$sb.AppendLine("  $k: $v")
}

$secretYaml = $sb.ToString()
$secretYaml | kubectl apply -f -

kubectl apply -f "$PSScriptRoot/namespace.yaml"
kubectl apply -f "$PSScriptRoot/services.yaml"
kubectl apply -f "$PSScriptRoot/auth-deployment.yaml"
kubectl apply -f "$PSScriptRoot/user-deployment.yaml"
kubectl apply -f "$PSScriptRoot/gateway-deployment.yaml"

## Optionally override images if env vars are provided (AUTH_IMAGE, USER_IMAGE, GATEWAY_IMAGE)
if ($authImage) { kubectl set image deployment/foodfund-auth -n $namespace auth-service=$authImage --record }
if ($userImage) { kubectl set image deployment/foodfund-user -n $namespace user-service=$userImage --record }
if ($gatewayImage) { kubectl set image deployment/foodfund-gateway -n $namespace gateway-service=$gatewayImage --record }

Write-Host "Applied manifests to namespace $namespace."
