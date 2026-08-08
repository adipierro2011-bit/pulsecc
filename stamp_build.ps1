param(
    [Parameter(Mandatory=$true)][string]$InputFile,
    [Parameter(Mandatory=$true)][string]$OutputFile,
    [string]$BuildID = ""
)

if (-not (Test-Path $InputFile)) {
    Write-Host "[!] Input file not found: $InputFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($BuildID)) {
    $guid = [guid]::NewGuid().ToString().Substring(0, 6).ToUpper()
    $BuildID = "BLD-$guid"
}

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $InputFile))
$markerStr = "MARKER_BUILD_ID_START:"
$markerBytes = [System.Text.Encoding]::ASCII.GetBytes($markerStr)
$bufferSize = 80

# Build 80-byte replacement payload
$payloadStr = $markerStr + $BuildID
$payloadBytes = [System.Text.Encoding]::ASCII.GetBytes($payloadStr)

if ($payloadBytes.Length -gt $bufferSize) {
    $payloadBytes = $payloadBytes[0..($bufferSize - 1)]
} else {
    $padded = New-Object byte[] $bufferSize
    [System.Buffer]::BlockCopy($payloadBytes, 0, $padded, 0, $payloadBytes.Length)
    $payloadBytes = $padded
}

# Scan and replace all marker occurrences in the PE file
$replacedCount = 0
for ($i = 0; $i -le ($bytes.Length - $markerBytes.Length); $i++) {
    $match = $true
    for ($j = 0; $j -lt $markerBytes.Length; $j++) {
        if ($bytes[$i + $j] -ne $markerBytes[$j]) {
            $match = $false
            break
        }
    }
    if ($match) {
        [System.Buffer]::BlockCopy($payloadBytes, 0, $bytes, $i, $bufferSize)
        $replacedCount++
        $i += $bufferSize - 1
    }
}

if ($replacedCount -eq 0) {
    Write-Host "[!] Error: MARKER_BUILD_ID_START signature not found in binary." -ForegroundColor Red
    exit 1
}

# Polymorphic signature mutation: append random bytes (16 to 64 bytes)
$rand = New-Object System.Random
$padLen = $rand.Next(16, 65)
$padding = New-Object byte[] $padLen
$rand.NextBytes($padding)

$finalBytes = New-Object byte[] ($bytes.Length + $padLen)
[System.Buffer]::BlockCopy($bytes, 0, $finalBytes, 0, $bytes.Length)
[System.Buffer]::BlockCopy($padding, 0, $finalBytes, $bytes.Length, $padLen)

[System.IO.File]::WriteAllBytes($OutputFile, $finalBytes)
Write-Host "[+] Polymorphic build generated successfully!" -ForegroundColor Green
Write-Host "    - Output File: $OutputFile"
Write-Host "    - Build ID:    $BuildID"
Write-Host "    - Matches:     $replacedCount"
Write-Host "    - File Size:   $($finalBytes.Length) bytes"
