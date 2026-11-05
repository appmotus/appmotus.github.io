# Estime les heures de travail passées sur Motus avec Claude Code, à partir des dates des échanges des sessions.
# Deux échanges espacés de plus de 30 minutes comptent comme une pause : le temps entre les deux n'est pas compté.
# 30 minutes laissent le temps de lire, de réfléchir ou d'attendre un long traitement (choix de l'utilisateur, 2 novembre 2026).
# Compte aussi les jetons consommés par Claude, sous-agents compris : chaque réponse n'est comptée qu'une fois.
# Les résultats vont dans HEURES_TRAVAIL et JETONS_CONSOMMES (js/constantes.js), à chaque nouvelle version.
param(
  [string]$Dossier = (Join-Path $env:USERPROFILE '.claude\projects\C--Users-User-Documents-10---Bricolages-WebApp'),
  [int]$PauseMinutes = 30
)
$motif = [regex]'"timestamp":"([0-9T:.\-]+Z)"'
$dates = New-Object 'System.Collections.Generic.List[datetime]'
Get-ChildItem $Dossier -Filter *.jsonl -File | ForEach-Object {
  foreach ($ligne in [IO.File]::ReadLines($_.FullName)) {
    $m = $motif.Match($ligne)
    if ($m.Success) { $dates.Add([datetime]::Parse($m.Groups[1].Value).ToUniversalTime()) }
  }
}
$dates.Sort()
$actif = [TimeSpan]::Zero
for ($i = 1; $i -lt $dates.Count; $i++) {
  $ecart = $dates[$i] - $dates[$i - 1]
  if ($ecart.TotalMinutes -le $PauseMinutes) { $actif += $ecart }
}
"Du $($dates[0].ToString('yyyy-MM-dd')) au $($dates[$dates.Count - 1].ToString('yyyy-MM-dd')), $($dates.Count) horodatages"
"Temps actif : $([math]::Round($actif.TotalHours, 1)) h (pauses de plus de $PauseMinutes min exclues)"

# Une réponse en plusieurs morceaux est écrite sur plusieurs lignes avec le même identifiant, parfois dans plusieurs fichiers
# (session reprise) : on ne la compte qu'une fois, avec les plus grandes valeurs vues.
$idMsg = [regex]'"message":\{[^{]*?"id":"(msg_[^"]+)"'
$champs = '"input_tokens":(\d+)', '"cache_creation_input_tokens":(\d+)', '"cache_read_input_tokens":(\d+)', '"output_tokens":(\d+)'
$parReponse = @{}
Get-ChildItem $Dossier -Filter *.jsonl -File -Recurse | ForEach-Object {
  foreach ($ligne in [IO.File]::ReadLines($_.FullName)) {
    if ($ligne -notmatch '"usage":\{') { continue }
    $id = $idMsg.Match($ligne)
    $cle = if ($id.Success) { $id.Groups[1].Value } else { [guid]::NewGuid().ToString() }
    if (-not $parReponse[$cle]) { $parReponse[$cle] = [long[]](0, 0, 0, 0) }
    for ($k = 0; $k -lt 4; $k++) {
      $m = [regex]::Match($ligne, $champs[$k])
      if ($m.Success) { $parReponse[$cle][$k] = [Math]::Max($parReponse[$cle][$k], [long]$m.Groups[1].Value) }
    }
  }
}
$t = [long[]](0, 0, 0, 0)
foreach ($v in $parReponse.Values) { for ($k = 0; $k -lt 4; $k++) { $t[$k] += $v[$k] } }
$mio = { param($n) [math]::Round($n / 1e6, 1) }
"Jetons : $(& $mio ($t[0] + $t[1] + $t[2] + $t[3])) millions au total, sur $($parReponse.Count) réponses de Claude"
"  relus depuis le cache : $(& $mio $t[2]) millions"
"  envoyés à Claude : $(& $mio ($t[0] + $t[1])) millions"
"  écrits par Claude : $(& $mio $t[3]) millions"
