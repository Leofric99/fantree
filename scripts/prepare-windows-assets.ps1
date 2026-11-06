param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\build')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$output = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($output) | Out-Null

function New-BrandBitmap {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [switch]$Sidebar
  )

  $bitmap = New-Object -TypeName System.Drawing.Bitmap -ArgumentList @(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(21, 22, 26))

  $gold = New-Object -TypeName System.Drawing.Pen -ArgumentList @(
    [System.Drawing.Color]::FromArgb(225, 183, 103),
    3.2
  )
  $softGold = New-Object -TypeName System.Drawing.Pen -ArgumentList @(
    [System.Drawing.Color]::FromArgb(170, 133, 76),
    2.4
  )
  $gold.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $gold.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $softGold.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $softGold.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  if ($Sidebar) {
    $graphics.DrawArc($gold, 18, 38, 128, 128, 200, 140)
    $graphics.DrawArc($softGold, 42, 62, 80, 80, 200, 140)
    $graphics.FillEllipse([System.Drawing.Brushes]::Goldenrod, 78, 121, 9, 9)
    $font = New-Object -TypeName System.Drawing.Font -ArgumentList @('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawString('FANTREE', $font, [System.Drawing.Brushes]::White, 20, 190)
    $font.Dispose()
  } else {
    $graphics.DrawArc($gold, 8, 13, 42, 42, 200, 140)
    $graphics.DrawArc($softGold, 18, 23, 22, 22, 200, 140)
    $graphics.FillEllipse([System.Drawing.Brushes]::Goldenrod, 22, 38, 6, 6)
    $font = New-Object -TypeName System.Drawing.Font -ArgumentList @('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
    $graphics.DrawString('FANTREE', $font, [System.Drawing.Brushes]::White, 60, 21)
    $font.Dispose()
  }

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $gold.Dispose()
  $softGold.Dispose()
  $bitmap.Dispose()
}

function New-BrandIcon {
  param([string]$Path)

  $bitmap = New-Object -TypeName System.Drawing.Bitmap -ArgumentList @(
    64,
    64,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $background = New-Object -TypeName System.Drawing.SolidBrush -ArgumentList @(
    [System.Drawing.Color]::FromArgb(255, 21, 22, 26)
  )
  $graphics.FillRectangle($background, 0, 0, 64, 64)
  $pen = New-Object -TypeName System.Drawing.Pen -ArgumentList @(
    [System.Drawing.Color]::FromArgb(225, 183, 103),
    6
  )
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($pen, 8, 15, 48, 42, 200, 140)
  $pen.Width = 4
  $graphics.DrawArc($pen, 19, 26, 26, 26, 200, 140)
  $graphics.FillEllipse([System.Drawing.Brushes]::Goldenrod, 28, 42, 8, 8)

  $handle = $bitmap.GetHicon()
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $stream = New-Object -TypeName System.IO.FileStream -ArgumentList @(
    $Path,
    [System.IO.FileMode]::Create
  )
  $icon.Save($stream)
  $stream.Dispose()
  $icon.Dispose()

  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FantreeIconHandle {
  [DllImport("user32.dll", SetLastError=true)] public static extern bool DestroyIcon(IntPtr handle);
}
'@
  [FantreeIconHandle]::DestroyIcon($handle) | Out-Null
  $pen.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-BrandBitmap -Width 150 -Height 57 -Path (Join-Path $output 'installerHeader.bmp')
New-BrandBitmap -Width 164 -Height 314 -Path (Join-Path $output 'installerSidebar.bmp') -Sidebar
New-BrandIcon -Path (Join-Path $output 'icon.ico')
Copy-Item (Join-Path $output 'icon.ico') (Join-Path $output 'installerIcon.ico') -Force
Copy-Item (Join-Path $output 'icon.ico') (Join-Path $output 'uninstallerIcon.ico') -Force
