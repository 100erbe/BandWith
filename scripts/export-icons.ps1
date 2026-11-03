# Automated SVG Exporter for BandWith Studio Vector Icon System
# Extracts all createIcon() & BrandIcon definitions and outputs standalone .svg files + manifest.json to public/icons/

$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$outputDir = "public/icons"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
} else {
    Get-ChildItem -Path $outputDir -Filter "*.svg" | Remove-Item -Force
}

Write-Host "Exporting all BandWith Studio Vector icons to $outputDir..."

$iconsFile = "src/app/components/icons/custom-icons.tsx"
$brandFile = "src/app/components/icons/brand-icons.tsx"

function Convert-ToKebabCase([string]$name) {
    $s = $name -creplace '([A-Z]+)([A-Z][a-z])', '$1-$2'
    $s = $s -creplace '([a-z0-9])([A-Z])', '$1-$2'
    return $s.ToLower()
}

function Export-CreateIcons($filePath, $defaultCategory) {
    $content = [System.IO.File]::ReadAllText($filePath)
    $regex = "export const\s+([A-Za-z0-9_]+)\s*=\s*createIcon\(\s*['""]([A-Za-z0-9_]+)['""]\s*,\s*\(\)\s*=>\s*\(?([\s\S]*?)\)?\s*(?:,\s*['""]([^'""]+)['""])?\s*(?:,\s*([0-9.]+))?\s*\);"
    $matches = [System.Text.RegularExpressions.Regex]::Matches($content, $regex)

    $manifest = @()

    foreach ($m in $matches) {
        $iconName = $m.Groups[1].Value
        $innerJsx = $m.Groups[3].Value.Trim()
        $viewBox = if ($m.Groups[4].Value) { $m.Groups[4].Value } else { "0 0 24 24" }
        $strokeWidth = if ($m.Groups[5].Value) { $m.Groups[5].Value } else { "2" }

        $vbParts = $viewBox -split '\s+'
        $svgW = if ($vbParts.Count -ge 4) { $vbParts[2] } else { "24" }
        $svgH = if ($vbParts.Count -ge 4) { $vbParts[3] } else { "24" }

        $cleanXml = $innerJsx -replace "^\s*<>\s*", "" -replace "\s*<\/>\s*$", ""
        $cleanXml = $cleanXml -replace "strokeWidth=", "stroke-width="
        $cleanXml = $cleanXml -replace "strokeLinecap=", "stroke-linecap="
        $cleanXml = $cleanXml -replace "strokeLinejoin=", "stroke-linejoin="
        $cleanXml = $cleanXml -replace "fillRule=", "fill-rule="
        $cleanXml = $cleanXml.Trim()

        $indentedXml = (($cleanXml -split "\r?\n") | ForEach-Object { "  " + $_.Trim() }) -join "`n"

        $svg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$svgW`" height=`"$svgH`" viewBox=`"$viewBox`" fill=`"none`" stroke=`"currentColor`" stroke-width=`"$strokeWidth`" stroke-linecap=`"round`" stroke-linejoin=`"round`">`n$indentedXml`n</svg>`n"

        $cat = if ($iconName -match '^Instrument') {
            "Instrument"
        } elseif ($iconName -match '^Icon') {
            "NavigationDock"
        } else {
            $defaultCategory
        }

        $kebabName = Convert-ToKebabCase $iconName
        $svgPath = Join-Path $outputDir "$kebabName.svg"
        [System.IO.File]::WriteAllText($svgPath, $svg, $utf8NoBom)

        $manifest += [PSCustomObject]@{
            Name = $iconName
            File = "$kebabName.svg"
            ViewBox = $viewBox
            StrokeWidth = $strokeWidth
            Category = $cat
        }
    }

    return $manifest
}

function Export-FilledBrandIcons($filePath) {
    $content = [System.IO.File]::ReadAllText($filePath)
    $regex = "export const\s+([A-Za-z0-9_]+BrandIcon)\s*:\s*React\.FC<IconProps>\s*=\s*\(\{\s*size\s*=\s*([0-9]+)[\s\S]*?<svg([\s\S]*?)>([\s\S]*?)<\/svg>"
    $matches = [System.Text.RegularExpressions.Regex]::Matches($content, $regex)

    $manifest = @()
    foreach ($m in $matches) {
        $iconName = $m.Groups[1].Value
        $defaultSize = $m.Groups[2].Value
        $svgAttrs = $m.Groups[3].Value
        $innerPaths = $m.Groups[4].Value.Trim()

        $vbMatch = [regex]::Match($svgAttrs, 'viewBox="([^"]+)"')
        $viewBox = if ($vbMatch.Success) { $vbMatch.Groups[1].Value } else { "0 0 24 24" }
        $hasCurrentFill = $svgAttrs -match 'fill="currentColor"'
        $fillAttr = if ($hasCurrentFill) { ' fill="currentColor"' } else { '' }

        $indentedPaths = (($innerPaths -split "\r?\n") | ForEach-Object { "  " + $_.Trim() }) -join "`n"
        $svg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$defaultSize`" height=`"$defaultSize`" viewBox=`"$viewBox`"$fillAttr>`n$indentedPaths`n</svg>`n"

        $kebabName = Convert-ToKebabCase $iconName
        $svgPath = Join-Path $outputDir "$kebabName.svg"
        [System.IO.File]::WriteAllText($svgPath, $svg, $utf8NoBom)

        $manifest += [PSCustomObject]@{
            Name = $iconName
            File = "$kebabName.svg"
            ViewBox = $viewBox
            StrokeWidth = "filled"
            Category = "ThirdPartyBrand"
        }
    }
    return $manifest
}

$manifestBrand = Export-CreateIcons $brandFile "Brand"
$manifestThirdParty = Export-FilledBrandIcons $brandFile
$manifestCustom = Export-CreateIcons $iconsFile "UI"
$allManifest = $manifestBrand + $manifestThirdParty + $manifestCustom

$json = $allManifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $outputDir "manifest.json"), $json + "`n", $utf8NoBom)

Write-Host "Successfully exported $($allManifest.Count) SVG icons to $outputDir!"
Write-Host ("  - Stage & Dock & Instrument Icons: " + $manifestBrand.Count)
Write-Host ("  - Third-Party OAuth/Streaming Icons: " + $manifestThirdParty.Count)
Write-Host ("  - Canonical UI & Domain Icons: " + $manifestCustom.Count)
Write-Host "Manifest saved to $outputDir/manifest.json"
