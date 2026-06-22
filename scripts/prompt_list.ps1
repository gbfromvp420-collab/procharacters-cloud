param(
    [string]$Brand,
    [string]$Tag,
    [switch]$Json
)

$Root = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $Root "prompts\manifest.json"

$data = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$entries = @($data.entries)

if ($Brand) {
    $entries = $entries | Where-Object { $_.brand -eq $Brand }
}
if ($Tag) {
    $entries = $entries | Where-Object { $_.tags -contains $Tag }
}

if ($Json) {
    $entries | ConvertTo-Json -Depth 10
    exit 0
}

if ($entries.Count -eq 0) {
    Write-Host "No prompts found."
    exit 0
}

Write-Host "Prompt Library ($($entries.Count) entries)`n"
foreach ($e in $entries) {
    $tags = ($e.tags -join ", ")
    Write-Host "  $($e.id) v$($e.version)"
    Write-Host "    Name:   $($e.name)"
    Write-Host "    Brand:  $($e.brand)"
    Write-Host "    Path:   $($e.path)"
    Write-Host "    Tags:   $tags"
    Write-Host ""
}