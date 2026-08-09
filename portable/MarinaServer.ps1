param(
  [string]$Root = (Join-Path $PSScriptRoot ".."),
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$rootPath = [System.IO.Path]::GetFullPath($Root)
$logPath = Join-Path $rootPath "marina-server-error.txt"
$listener = $null

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
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()

  $url = "http://localhost:$Port/"
  $edgeCandidates = @()
  if (${env:ProgramFiles}) { $edgeCandidates += Join-Path ${env:ProgramFiles} "Microsoft\Edge\Application\msedge.exe" }
  if (${env:ProgramFiles(x86)}) { $edgeCandidates += Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe" }
  $edgeCandidates = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ }
  if ($edgeCandidates.Count -gt 0) { Start-Process -FilePath $edgeCandidates[0] -ArgumentList $url }
  else { Start-Process $url }

  Write-Host "Marina started: $url" -ForegroundColor Green
  Write-Host "Close this window to stop Marina." -ForegroundColor DarkGray

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
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
    } catch {
      if ($context.Response) { $context.Response.StatusCode = 500; $context.Response.Close() }
    }
  }
} catch {
  $message = "Marina could not start.`r`n`r`nError: $($_.Exception.Message)`r`n`r`nCheck that port 8765 is free, then try again."
  try { Set-Content -LiteralPath $logPath -Value $message -Encoding UTF8 } catch { }
  Write-Host $message -ForegroundColor Red
  Read-Host "Press Enter to close this window"
  exit 1
} finally {
  if ($listener -and $listener.IsListening) { $listener.Stop() }
  if ($listener) { $listener.Close() }
}
