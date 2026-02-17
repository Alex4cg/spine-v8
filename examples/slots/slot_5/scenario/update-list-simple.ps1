# Простая версия скрипта обновления list.json

$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
$listFile = "$folder\list.json"

# Находим все файлы
$files = Get-ChildItem "$folder\scenario_*.json" | Sort-Object Name

# Создаем JSON вручную
$json = "[" + [Environment]::NewLine
for ($i = 0; $i -lt $files.Count; $i++) {
    $name = $files[$i].Name
    $comma = if ($i -lt $files.Count - 1) { "," } else { "" }
    $json += "  `"$name`"$comma" + [Environment]::NewLine
}
$json += "]"

# Записываем файл
$json | Out-File -FilePath $listFile -Encoding UTF8 -NoNewline

Write-Host "Готово! Найдено файлов: $($files.Count)"
