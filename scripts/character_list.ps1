param(
    [ValidateSet("draft", "active", "archived")]
    [string]$Status,
    [string]$Brand,
    [switch]$Json
)

$Root = Split-Path -Parent $PSScriptRoot
$RegistryPath = Join-Path $Root "characters\registry.json"

$data = Get-Content $RegistryPath -Raw | ConvertFrom-Json
$entries = @($data.entries)

if ($Status) {
    $entries = $entries | Where-Object { $_.status -eq $Status }
}
if ($Brand) {
    $entries = $entries | Where-Object { $_.brand -eq $Brand }
}

if ($Json) {
    @{
        active_models = $data.active_models
        entries = $entries
    } | ConvertTo-Json -Depth 10
    exit 0
}

if ($entries.Count -eq 0) {
    Write-Host "No characters found."
    exit 0
}

Write-Host "Character Registry ($($entries.Count) entries)`n"
Write-Host "Active slots:"
$data.active_models.PSObject.Properties | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Value)"
}
Write-Host ""

foreach ($e in $entries) {
    $activeMarker = ""
    $data.active_models.PSObject.Properties | ForEach-Object {
        if ($_.Value -eq $e.id) {
            $activeMarker = " [ACTIVE: $($_.Name)]"
        }
    }
    Write-Host "  $($e.id) v$($e.version)$activeMarker"
    Write-Host "    Name:        $($e.name)"
    Write-Host "    Status:      $($e.status)"
    Write-Host "    Prompt ref:  $($e.prompt_ref)"
    Write-Host "    Path:        $($e.path)"
    Write-Host ""
}