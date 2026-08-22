<#
  pull-iphone.ps1 - copy a screen recording off the connected iPhone.

  WHY THIS SHAPE: iOS on Windows exposes the camera roll over WPD (MTP), not as
  a drive letter, so Copy-Item does not work. Shell.Application's CopyHere is the
  only route, and it is asynchronous - the loop at the bottom waits for the file
  to actually appear rather than assuming.

  Live screen MIRRORING from Windows is not available (that needs QuickTime on a
  Mac, or a Developer Disk Image mount). The supported path is: record the app
  with iOS Screen Recording, then pull the file with this.

  Usage:
    pull-iphone.ps1 -List
    pull-iphone.ps1 -Name IMG_1332.MOV -Dest C:\path\to\ingest
#>
param([switch]$List, [string]$Name, [string]$Dest = "$PSScriptRoot\ingest")

$shell = New-Object -ComObject Shell.Application
$phone = $null
foreach ($i in $shell.NameSpace(17).Items()) { if ($i.Name -match 'iPhone') { $phone = $i } }
if (-not $phone) { Write-Error "No iPhone found. Unlock it and tap Trust."; exit 2 }

$files = @()
foreach ($storage in $phone.GetFolder.Items()) {
  foreach ($album in $storage.GetFolder.Items()) {
    $af = $album.GetFolder
    foreach ($f in $af.Items()) {
      $files += [pscustomobject]@{
        Name = $f.Name; Album = $album.Name; Item = $f; Folder = $af
        Modified = $af.GetDetailsOf($f, 3)
      }
    }
  }
}

if ($List -or -not $Name) {
  $files | Sort-Object Album, Name | ForEach-Object {
    Write-Output ("{0,-22} {1,-10} {2}" -f $_.Name, $_.Album, $_.Modified)
  }
  Write-Output ("total: " + $files.Count)
  exit 0
}

$match = $files | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
if (-not $match) { Write-Error "Not found on device: $Name"; exit 3 }

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$destFolder = $shell.NameSpace($Dest)
$destFolder.CopyHere($match.Item)

$target = Join-Path $Dest $Name
for ($i = 0; $i -lt 120; $i++) {
  if (Test-Path $target) {
    $len = (Get-Item $target).Length
    Start-Sleep -Milliseconds 400
    if ((Get-Item $target).Length -eq $len -and $len -gt 0) {
      Write-Output ("PULLED " + $target + "  " + [math]::Round($len/1MB,2) + " MB")
      exit 0
    }
  }
  Start-Sleep -Milliseconds 500
}
Write-Error "Copy did not complete for $Name"; exit 4
