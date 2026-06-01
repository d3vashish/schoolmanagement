$files = @(
  'src\pages\Classes.jsx',
  'src\pages\Courses.jsx',
  'src\pages\Homework.jsx',
  'src\pages\Schedule.jsx',
  'src\pages\UserDetail.jsx',
  'src\pages\Users.jsx',
  'src\pages\Login.jsx'
)

foreach ($f in $files) {
  $content = Get-Content $f -Raw
  $content = $content -replace '#f97316','#2ED05D'
  $content = $content -replace '#ea580c','#25B04E'
  $content = $content -replace '#fed7aa','#BBF7D0'
  $content = $content -replace '#fff3e8','#E8F9ED'
  $content = $content -replace 'rgba\(249,115,22,0\.1\)','rgba(46,208,93,0.12)'
  $content = $content -replace 'rgba\(249,115,22,0\.12\)','rgba(46,208,93,0.12)'
  $content = $content -replace 'rgba\(249,115,22,0\.08\)','rgba(46,208,93,0.12)'
  Set-Content $f -Value $content -NoNewline
  Write-Host "Done: $f"
}
