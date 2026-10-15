# ==========================================================================
# TAZA-PHAL-SABZI.COM - local MySQL root password reset (ASCII-safe)
# Run through reset-mysql-password.bat (self-elevating, keeps the window open)
# Resets: root@localhost -> password "root"   (local development only)
# ==========================================================================

$ErrorActionPreference = "Continue"
$log = "$env:TEMP\mysql-reset-log.txt"
function Log($m) { $line = "[" + (Get-Date -Format 'HH:mm:ss') + "] " + $m; Add-Content -Path $log -Value $line; Write-Host $line }

Set-Content -Path $log -Value ("MySQL password reset - " + (Get-Date))

# keep a full copy of everything printed (visible even if the window closes)
try { Start-Transcript -Path "$env:TEMP\mysql-reset-console.txt" -Force | Out-Null } catch { }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Log "NOT ELEVATED - right-click reset-mysql-password.bat and choose Run as administrator"
  exit 1
}
Log "Running elevated OK"

$mysqld     = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
$mysql      = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$mysqladmin = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqladmin.exe"
$ini        = "C:\ProgramData\MySQL\MySQL Server 8.0\my.ini"
$svc        = "MySQL80"

foreach ($p in @($mysqld, $mysql, $mysqladmin, $ini)) {
  if (-not (Test-Path $p)) { Log ("MISSING: " + $p); continue }
}
if (-not (Test-Path $mysqld) -or -not (Test-Path $ini)) { Log "Required files missing - aborting"; exit 1 }

# 1. stop the service if it is running
$state = (Get-Service $svc).Status
Log ("Service " + $svc + " is currently: " + $state)
if ($state -ne "Stopped") {
  net stop $svc | Out-Null
  Start-Sleep -Seconds 3
  Log "Service stopped"
}

# 2. temp init file with a strong password (works even with validate_password)
$init = "$env:TEMP\mysql-reset-init.sql"
Set-Content -Path $init -Value "ALTER USER 'root'@'localhost' IDENTIFIED BY 'TazaRoot@123';" -Encoding ascii
Log "Init file ready"

# 3. start mysqld manually with the init file
$outLog = "$env:TEMP\mysql-reset-out.txt"
$errLog = "$env:TEMP\mysql-reset-err.txt"
$proc = Start-Process -FilePath $mysqld -ArgumentList @("--defaults-file=`"$ini`"", "--init-file=`"$init`"") -PassThru -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog
Log ("mysqld started (PID " + $proc.Id + ") - waiting for port 3306...")

$up = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  if ($proc.HasExited) { break }
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect("127.0.0.1", 3306)
    $up = $true
    $client.Close()
    break
  } catch { $client.Close() }
}
if (-not $up) {
  Log ("mysqld did not open port 3306 (exited: " + $proc.HasExited + ")")
  if (Test-Path $errLog) {
    Get-Content $errLog | Select-Object -Last 12 | ForEach-Object { Log ("  mysqld: " + $_) }
  }
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  exit 1
}
Log "MySQL is up (temporary password TazaRoot@123)"

# 4. relax the password policy (ignore error if plugin absent) then set final password
& $mysql -u root "-pTazaRoot@123" -e "SET GLOBAL validate_password.policy = LOW;" 2>$null | Out-Null
& $mysql -u root "-pTazaRoot@123" -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'root'; FLUSH PRIVILEGES;" 2>$null | Out-Null
Log "Password set to: root"

# 5. verify, then stop the temporary server
$v = & $mysql -u root "-proot" -N -e "SELECT VERSION();" 2>$null
if ($v) { Log ("Verified login root/root - MySQL " + $v) } else { Log "VERIFY FAILED before shutdown" }

& $mysqladmin -u root "-proot" shutdown 2>$null | Out-Null
Start-Sleep -Seconds 3
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force; Log "temp mysqld force-stopped" } else { Log "temp mysqld shut down cleanly" }

# 6. start the Windows service again
net start $svc | Out-Null
Start-Sleep -Seconds 4
Log ("Service " + $svc + " is now: " + (Get-Service $svc).Status)

# 7. final verification through the service
$v2 = & $mysql -u root "-proot" -N -e "SELECT VERSION();" 2>$null
if ($v2) { Log ("DONE - login root/root works on the MySQL service (" + $v2 + ")") } else { Log "Service started but root/root login failed - check manually" }

Remove-Item $init -Force -ErrorAction SilentlyContinue
Log "Finished"
try { Stop-Transcript | Out-Null } catch { }
