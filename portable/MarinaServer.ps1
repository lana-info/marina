param(
  [string]$Root = (Join-Path $PSScriptRoot ".."),
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$rootPath = [System.IO.Path]::GetFullPath($Root)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

function Get-MimeType([string]$path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".webmanifest" { return "application/manifest+json; charset=utf-8" }
    ".svg" { return "image/svg+xml" }
    default { return "application/octet-stream" }
  }
}

try {
  $listener.Start()
  $url = "http://localhost:$Port/"
  $edgeCandidates = @()
  if (${env:ProgramFiles}) { $edgeCandidates += Join-Path ${env:ProgramFiles} "Microsoft\Edge\Application\msedge.exe" }
  if (${env:ProgramFiles(x86)}) { $edgeCandidates += Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe" }
  $edgeCandidates = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ }
  if ($edgeCandidates.Count -gt 0) { Start-Process -FilePath $edgeCandidates[0] -ArgumentList $url }
  else { Start-Process $url }
  Write-Host "Marina запущена: http://localhost:$Port/"
  Write-Host "Для остановки закройте это окно."

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "index.html" }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootPath $relative))
    if (-not $candidate.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($candidate)
    $context.Response.ContentType = Get-MimeType $candidate
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
