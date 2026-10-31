# Génère icon-192.png et icon-512.png (fond terracotta + trois pastilles vert / jaune / rouge)
Add-Type -AssemblyName System.Drawing
$out = Split-Path $PSScriptRoot -Parent

foreach ($size in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#C27B42'))

  # Carte claire au centre (zone sûre des icônes "maskable")
  $u = $size / 100
  $card = New-Object System.Drawing.Drawing2D.GraphicsPath
  $x = 20 * $u; $y = 28 * $u; $w = 60 * $u; $h = 44 * $u; $r = 12 * $u
  $card.AddArc($x, $y, $r, $r, 180, 90); $card.AddArc($x + $w - $r, $y, $r, $r, 270, 90)
  $card.AddArc($x + $w - $r, $y + $h - $r, $r, $r, 0, 90); $card.AddArc($x, $y + $h - $r, $r, $r, 90, 90)
  $card.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F9F6F0'))), $card)

  $d = 14 * $u
  $cols = '#3FA35B', '#E3B21F', '#D9534F'
  for ($i = 0; $i -lt 3; $i++) {
    $cx = (31 + 19 * $i) * $u
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($cols[$i]))), $cx - $d / 2, 50 * $u - $d / 2, $d, $d)
  }
  $g.Dispose()
  $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
