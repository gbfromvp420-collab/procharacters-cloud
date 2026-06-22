param(
    [Parameter(Mandatory = $true)]
    [string]$Id,
    [string]$Version,
    [switch]$MetaOnly
)

$Root = Split-Path -Parent $PSScriptRoot
$ManifestPath = Join-Path $Root "prompts\manifest.json"

$data = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$matches = @($data.entries | Where-Object { $_.id -eq $Id })

if ($matches.Count -eq 0) {
    Write-Host "Error: No prompt found with id '$Id'"
    exit 1
}

if ($Version) {
    $target = $Version.TrimStart("v")
    $entry = $matches | Where-Object { ($_.version.TrimStart("v")) -eq $target } | Select-Object -First 1
    if (-not $entry) {
        Write-Host "Error: No version '$Version' for prompt '$Id'"
        exit 1
    }
} else {
    $entry = $matches | Sort-Object {
        $parts = ($_.version.TrimStart("v") -split "\.") | ForEach-Object { [int]$_ }
        [long]($parts[0] * 1000000 + $parts[1] * 1000 + $parts[2])
    } -Descending | Select-Object -First 1
}

$promptPath = Join-Path $Root "prompts\$($entry.path)"

Write-Host "ID:      $($entry.id)"
Write-Host "Version: $($entry.version)"
Write-Host "Name:    $($entry.name)"
Write-Host "Brand:   $($entry.brand)"
Write-Host "Path:    $($entry.path)"
Write-Host ""

if ($MetaOnly) { exit 0 }

if (-not (Test-Path $promptPath)) {
    Write-Host "Error: Prompt file not found at $promptPath"
    exit 1
}

Write-Host "--- PROMPT ---"
Get-Content $promptPath -Raw