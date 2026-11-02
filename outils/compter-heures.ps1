# Estime les heures de travail passées sur Motus avec Claude Code, à partir des dates des échanges des sessions.
# Deux échanges espacés de plus de 30 minutes comptent comme une pause : le temps entre les deux n'est pas compté.
# 30 minutes laissent le temps de lire, de réfléchir ou d'attendre un long traitement (choix de l'utilisateur, 2 novembre 2026).
# Le résultat va dans HEURES_TRAVAIL (index.html), à chaque nouvelle version.
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
