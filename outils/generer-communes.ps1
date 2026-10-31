# Génère communes.txt : une ligne par commune française "Nom<TAB>latitude<TAB>longitude"
# Source : API Découpage administratif (geo.api.gouv.fr), centre de chaque commune.
# Les arrondissements de Paris, Lyon et Marseille sont ajoutés sous le nom de leur ville
# pour éviter qu'un point dans Paris soit rattaché à une commune voisine.
Add-Type -AssemblyName System.Web.Extensions
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'communes.txt'
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue

function Get-Communes($url) {
  $r = Invoke-WebRequest $url -UseBasicParsing
  $json.DeserializeObject([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()))
}

$base = 'https://geo.api.gouv.fr/communes?fields=nom,centre&format=json'
$all = @(Get-Communes $base) + @(Get-Communes "$base&type=arrondissement-municipal")

$inv = [Globalization.CultureInfo]::InvariantCulture
$sb = New-Object Text.StringBuilder
$n = 0
foreach ($c in $all) {
  if (-not $c.centre) { continue }
  $nom = $c.nom -replace ' \d+(er|e) Arrondissement$', ''
  $lon = [double]$c.centre.coordinates[0]; $lat = [double]$c.centre.coordinates[1]
  [void]$sb.Append($nom).Append("`t").Append($lat.ToString('0.###', $inv)).Append("`t").Append($lon.ToString('0.###', $inv)).Append("`n")
  $n++
}
[IO.File]::WriteAllText($out, $sb.ToString().TrimEnd("`n"), (New-Object Text.UTF8Encoding($false)))
"$n communes écrites dans $out ($([math]::Round((Get-Item $out).Length / 1KB)) Ko)"
