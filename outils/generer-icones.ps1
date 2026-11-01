# Génère icon-192.png et icon-512.png (fond bleu nuit + trois lueurs vert / jaune / rouge)
Add-Type -AssemblyName System.Drawing
$out = Split-Path $PSScriptRoot -Parent

foreach ($size in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#1D1B4C'))

  # Les pastilles restent dans la zone sûre des icônes "maskable"
  $u = $size / 512
  $d = 96 * $u
  $cols = '#3FAE82', '#EBB033', '#EC6A6F'
  for ($i = 0; $i -lt 3; $i++) {
    $cx = (136 + 120 * $i) * $u
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($cols[$i]))), $cx - $d / 2, 256 * $u - $d / 2, $d, $d)
  }
  $g.Dispose()
  $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
