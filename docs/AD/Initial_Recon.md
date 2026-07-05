# Initial Recon

Initial recon in Active Directory is about building the first map of the environment.

At this stage, the goal is to identify live hosts, exposed services, possible domain names, domain controllers, DNS records, SMB behavior, LDAP exposure, RPC access, Kerberos responses, and valid usernames.

The first useful questions are:

- What network ranges are reachable?
- Which hosts are alive?
- Which systems look like domain controllers?
- What is the AD domain name?
- Which DNS records expose AD services?
- Does SMB allow null or guest access?
- Does LDAP allow anonymous bind?
- Does RPC expose domain information?
- Does Kerberos reveal valid users?
- Can a username list be built safely?

Useful resources:

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [HackTricks - rpcclient Enumeration](https://hacktricks.wiki/en/network-services-pentesting/pentesting-smb/rpcclient-enumeration.html)
- [The Hacker Recipes - AD Port Scanning](https://www.thehacker.recipes/ad/recon/port-scanning)
- [NetExec Documentation](https://www.netexec.wiki/)
- [Kerbrute](https://github.com/ropnop/kerbrute)
- [WADComs](https://wadcoms.github.io/)
- [PayloadsAllTheThings - Active Directory Attacks](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Active%20Directory%20Attack.md)

---

## Network Discovery

Network discovery is used to identify live hosts before deeper enumeration.

In AD labs, the domain controller is often one of the first targets to identify because it exposes services such as DNS, Kerberos, LDAP, SMB, RPC, and sometimes Global Catalog.

Basic variables used in examples:

```bash
export TARGET=10.10.10.10
export RANGE=10.10.10.0/24
export DOMAIN=corp.local
export DC_IP=10.10.10.10
```

Common host discovery methods:

| Method | Command |
| --- | --- |
| ICMP ping sweep | `fping -a -g $RANGE 2>/dev/null` |
| Nmap ping scan | `nmap -sn $RANGE` |
| ARP discovery | `sudo netdiscover -r $RANGE` |
| ARP scan | `sudo arp-scan -l` |
| TCP ping on common ports | `nmap -sn -PS445,3389,5985 $RANGE` |
| No ping, assume hosts are up | `nmap -Pn $RANGE` |

ICMP may be blocked, so a host that does not respond to ping can still be alive.

Good AD discovery ports:

```text
53,88,135,139,389,445,464,593,636,3268,3269,3389,5985,5986,9389
```

Fast check for likely Windows hosts:

```bash
nmap -Pn -n --open -p 135,139,445,3389,5985 $RANGE
```

Fast check for likely domain controllers:

```bash
nmap -Pn -n --open -p 53,88,389,445,464,636,3268,3269,9389 $RANGE
```

Quick NetExec host discovery over SMB:

```bash
nxc smb $RANGE
```

Useful things to note from first discovery:

| Finding | Why it matters |
| --- | --- |
| Hostname | May reveal role, location, or naming convention. |
| Open SMB | Windows host or file service. |
| Open Kerberos | Strong DC indicator. |
| Open LDAP | Strong DC indicator. |
| Open DNS | Possible DC or internal DNS server. |
| Open WinRM | Possible remote management path later. |
| Open RDP | Possible interactive access later. |
| Open MSSQL | Possible domain-integrated application or data target. |

If DNS is available, add the domain controller to `/etc/hosts` as soon as the name is known:

```bash
sudo sh -c 'echo "10.10.10.10 dc01.corp.local dc01 corp.local" >> /etc/hosts'
```

---

## Port Scanning

Port scanning identifies exposed services and helps decide which enumeration path to follow.

Start with a broad TCP scan, then run targeted scripts against interesting services.

Fast full TCP discovery:

```bash
sudo nmap -p- --min-rate 5000 -n -Pn $TARGET -oN nmap_all_ports.txt
```

Targeted service detection:

```bash
sudo nmap -sCV -Pn -n -p 53,88,135,139,389,445,464,593,636,3268,3269,3389,5985,5986,9389 $TARGET -oN nmap_ad_services.txt
```

UDP can be noisy but useful for DNS, Kerberos, NTP, NetBIOS, and SNMP:

```bash
sudo nmap -sU -Pn -n --top-ports 50 $TARGET -oN nmap_udp_top.txt
```

Targeted UDP scan:

```bash
sudo nmap -sU -Pn -n -p 53,88,123,137,138,161 $TARGET -oN nmap_udp_targeted.txt
```

Common AD-related ports:

| Port | Protocol | Service | Notes |
| --- | --- | --- | --- |
| `53` | TCP/UDP | DNS | Domain and service discovery. |
| `88` | TCP/UDP | Kerberos | Strong DC indicator. |
| `123` | UDP | NTP | Time sync, useful because Kerberos is time-sensitive. |
| `135` | TCP | RPC Endpoint Mapper | Windows RPC discovery. |
| `137` | UDP | NetBIOS Name Service | Legacy name discovery. |
| `138` | UDP | NetBIOS Datagram | Legacy Windows networking. |
| `139` | TCP | NetBIOS Session | Legacy SMB. |
| `389` | TCP/UDP | LDAP | Directory access. |
| `445` | TCP | SMB | Shares, domain info, Windows host enum. |
| `464` | TCP/UDP | Kerberos password change | Often present on DCs. |
| `593` | TCP | RPC over HTTP | Additional RPC exposure. |
| `636` | TCP | LDAPS | LDAP over TLS. |
| `1433` | TCP | MSSQL | Database service, often domain integrated. |
| `3268` | TCP | Global Catalog | Forest-wide LDAP. |
| `3269` | TCP | Global Catalog LDAPS | Forest-wide LDAPS. |
| `3389` | TCP | RDP | Interactive remote access. |
| `5985` | TCP | WinRM HTTP | Remote management. |
| `5986` | TCP | WinRM HTTPS | Remote management over TLS. |
| `9389` | TCP | AD Web Services | AD PowerShell-related service on DCs. |

Useful Nmap scripts:

```bash
nmap -Pn -n -p445 --script smb-protocols,smb-security-mode,smb2-security-mode $TARGET
nmap -Pn -n -p445 --script smb-os-discovery $TARGET
nmap -Pn -n -p389 --script ldap-rootdse $TARGET
nmap -Pn -n -p53 --script dns-service-discovery $TARGET
```

Good first interpretation:

| Ports | Possible meaning |
| --- | --- |
| `53,88,389,445` | Very likely a domain controller. |
| `445,3389,5985` | Likely Windows server or workstation. |
| `389,636,3268,3269` | Domain controller or LDAP service. |
| `88` without `389` | Kerberos exposed, check domain context carefully. |
| `1433` | MSSQL target, often worth noting for later. |
| `5985/5986` | WinRM may be useful after credentials. |

---

## Domain Discovery

Domain discovery identifies the AD domain name, NetBIOS name, DNS suffix, and possible realm.

Domain names can appear in several places:

| Source | Example |
| --- | --- |
| DNS records | `corp.local` |
| SMB banners | `CORP` |
| LDAP RootDSE | `DC=corp,DC=local` |
| Kerberos realm | `CORP.LOCAL` |
| TLS certificates | `dc01.corp.local` |
| Hostnames | `dc01.corp.local` |
| Nmap output | `Domain: CORP` |
| NetBIOS | `CORP<00>` |

Check SMB with NetExec:

```bash
nxc smb $TARGET
```

Possible output may reveal:

```text
Windows Server
name: DC01
domain: CORP
signing: True
SMBv1: False
```

Check SMB with Nmap:

```bash
nmap -Pn -n -p445 --script smb-os-discovery $TARGET
```

Check LDAP RootDSE if LDAP is open:

```bash
ldapsearch -x -H ldap://$TARGET -s base namingcontexts
```

Useful RootDSE query:

```bash
ldapsearch -x -H ldap://$TARGET -s base +
```

Look for:

| Field | Meaning |
| --- | --- |
| `defaultNamingContext` | Main domain DN. |
| `rootDomainNamingContext` | Forest root domain DN. |
| `configurationNamingContext` | Configuration partition. |
| `schemaNamingContext` | Schema partition. |
| `dnsHostName` | DC hostname. |
| `ldapServiceName` | Domain and DC service info. |
| `supportedSASLMechanisms` | Auth mechanisms supported by LDAP. |

Convert base DN to DNS domain:

```text
DC=corp,DC=local -> corp.local
DC=ad,DC=company,DC=com -> ad.company.com
```

Check Kerberos realm behavior:

```bash
nmap -Pn -n -p88 --script krb5-enum-users --script-args krb5-enum-users.realm='CORP.LOCAL',userdb=/usr/share/seclists/Usernames/top-usernames-shortlist.txt $TARGET
```

If a hostname is known, check DNS domain:

```bash
host dc01.corp.local $TARGET
dig @$TARGET dc01.corp.local
```

Update `/etc/hosts` when the domain and DC are known:

```bash
sudo sh -c 'echo "10.10.10.10 dc01.corp.local dc01 corp.local" >> /etc/hosts'
```

---

## DC Discovery

Domain Controller discovery identifies which hosts provide AD services.

A domain controller often exposes a recognizable combination of ports:

```text
53,88,135,389,445,464,636,3268,3269,9389
```

Fast DC candidate scan:

```bash
nmap -Pn -n --open -p 53,88,389,445,464,636,3268,3269,9389 $RANGE
```

Query DNS SRV records when the domain is known:

```bash
dig @$DC_IP _ldap._tcp.dc._msdcs.$DOMAIN SRV
dig @$DC_IP _kerberos._tcp.$DOMAIN SRV
dig @$DC_IP _kerberos._udp.$DOMAIN SRV
dig @$DC_IP _gc._tcp.$DOMAIN SRV
```

With `nslookup`:

```bash
nslookup -type=SRV _ldap._tcp.dc._msdcs.$DOMAIN $DC_IP
nslookup -type=SRV _kerberos._tcp.$DOMAIN $DC_IP
```

With `host`:

```bash
host -t SRV _ldap._tcp.dc._msdcs.$DOMAIN $DC_IP
host -t SRV _kerberos._tcp.$DOMAIN $DC_IP
```

LDAP RootDSE can identify the DC:

```bash
ldapsearch -x -H ldap://$DC_IP -s base dnsHostName defaultNamingContext rootDomainNamingContext
```

Nmap service detection can also confirm DC-like behavior:

```bash
nmap -sCV -Pn -n -p 53,88,135,389,445,464,636,3268,3269,9389 $DC_IP
```

Common indicators:

| Indicator | Meaning |
| --- | --- |
| Kerberos on `88` | Strong DC indicator. |
| LDAP on `389` | Strong DC indicator. |
| Global Catalog on `3268/3269` | DC is likely a Global Catalog. |
| DNS on `53` | DC may host AD-integrated DNS. |
| SMB shows domain name | Useful for NetBIOS/domain context. |
| ADWS on `9389` | Common on modern DCs. |

In multi-DC environments, identify all DCs before deeper testing:

```bash
dig @$DC_IP _ldap._tcp.dc._msdcs.$DOMAIN SRV +short
```

Resolve returned names:

```bash
for h in $(dig @$DC_IP _ldap._tcp.dc._msdcs.$DOMAIN SRV +short | awk '{print $4}' | sed 's/.$//'); do
  host $h $DC_IP
done
```

---

## DNS Enumeration

DNS enumeration is important because AD depends on DNS for service discovery.

Start with basic records:

```bash
dig @$DC_IP $DOMAIN
dig @$DC_IP $DOMAIN A
dig @$DC_IP $DOMAIN NS
dig @$DC_IP $DOMAIN SOA
dig @$DC_IP $DOMAIN MX
```

Check common AD SRV records:

```bash
dig @$DC_IP _ldap._tcp.$DOMAIN SRV
dig @$DC_IP _ldap._tcp.dc._msdcs.$DOMAIN SRV
dig @$DC_IP _kerberos._tcp.$DOMAIN SRV
dig @$DC_IP _kerberos._udp.$DOMAIN SRV
dig @$DC_IP _kpasswd._tcp.$DOMAIN SRV
dig @$DC_IP _kpasswd._udp.$DOMAIN SRV
dig @$DC_IP _gc._tcp.$DOMAIN SRV
dig @$DC_IP _ldap._tcp.gc._msdcs.$DOMAIN SRV
```

Important AD DNS zones:

| Zone | Meaning |
| --- | --- |
| `$DOMAIN` | Main domain DNS zone. |
| `_msdcs.$DOMAIN` | DC and AD service discovery zone. |
| `DomainDnsZones.$DOMAIN` | AD-integrated DNS application partition. |
| `ForestDnsZones.$DOMAIN` | Forest-wide DNS application partition. |

Try zone transfer only when in scope:

```bash
dig axfr @$DC_IP $DOMAIN
dig axfr @$DC_IP _msdcs.$DOMAIN
```

Bruteforce common hostnames:

```bash
dnsrecon -d $DOMAIN -n $DC_IP -D /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -t brt
```

Alternative with `dnsenum`:

```bash
dnsenum --dnsserver $DC_IP -f /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt $DOMAIN
```

Reverse lookup sweep:

```bash
for i in $(seq 1 254); do
  host 10.10.10.$i $DC_IP | grep -v "not found"
done
```

Useful records to note:

| Record | Why it matters |
| --- | --- |
| DC hostnames | Confirms domain controllers. |
| File servers | Often useful later for share enumeration. |
| SQL servers | May become important after credentials. |
| Web servers | May expose internal apps. |
| Backup servers | Often high-value infrastructure. |
| SCCM / WSUS | Management infrastructure. |
| AD CS names | May indicate certificate services. |
| Jump hosts | Admin access path later. |

Common hostname patterns worth recognizing:

```text
dc01
ad01
fs01
file01
sql01
db01
web01
app01
backup01
sccm01
wsus01
ca01
pki01
vpn01
jump01
admin01
```

---

## SMB Enumeration

SMB enumeration is one of the most useful early AD checks.

SMB can reveal:

- hostnames
- domain names
- SMB signing status
- SMB version
- null session access
- guest access
- shares
- readable files
- password policy
- users or groups in weak configurations

Start with NetExec:

```bash
nxc smb $RANGE
```

Check one target:

```bash
nxc smb $TARGET
```

Check SMB signing:

```bash
nxc smb $RANGE --gen-relay-list relay_targets.txt
```

Manual Nmap scripts:

```bash
nmap -Pn -n -p445 --script smb-protocols,smb-security-mode,smb2-security-mode $TARGET
nmap -Pn -n -p445 --script smb-os-discovery $TARGET
```

Null session checks:

```bash
smbclient -L //$TARGET/ -N
smbmap -H $TARGET -u '' -p ''
nxc smb $TARGET -u '' -p ''
```

Guest access checks:

```bash
smbclient -L //$TARGET/ -U 'guest%'
smbmap -H $TARGET -u guest -p ''
nxc smb $TARGET -u guest -p ''
```

List shares if anonymous or guest works:

```bash
smbclient -L //$TARGET/ -N
smbmap -H $TARGET -u '' -p ''
```

Connect to a share:

```bash
smbclient //$TARGET/SHARENAME -N
smbclient //$TARGET/SHARENAME -U 'guest%'
```

Recursive listing with `smbclient`:

```bash
smbclient //$TARGET/SHARENAME -N -c 'recurse ON; ls'
```

Download recursively in a lab when allowed:

```bash
smbclient //$TARGET/SHARENAME -N -c 'recurse ON; prompt OFF; mget *'
```

Common shares:

| Share | Notes |
| --- | --- |
| `ADMIN$` | Administrative share. |
| `C$` | Administrative drive share. |
| `IPC$` | Inter-process communication share. |
| `SYSVOL` | Domain policy and scripts, present on DCs. |
| `NETLOGON` | Logon scripts, present on DCs. |
| `Users` | User home folders or profiles. |
| `Shared` | Generic file share. |
| `Backups` | Often interesting in labs. |
| `IT` | Scripts, tools, configs, documentation. |
| `HR` | Documents, sometimes names and usernames. |

Look for interesting file types:

```text
*.txt
*.csv
*.xml
*.ini
*.config
*.conf
*.ps1
*.bat
*.cmd
*.vbs
*.kdbx
*.rdp
*.sql
*.bak
*.zip
*.7z
```

Quick local search after downloading files:

```bash
grep -RniE "pass|pwd|password|cred|secret|token|key|user|login" .
find . -iname "*.kdbx" -o -iname "*.config" -o -iname "*.ps1" -o -iname "*.xml" -o -iname "*.txt"
```

What to record:

| Field | Example |
| --- | --- |
| SMB hostname | `DC01` |
| Domain | `CORP` |
| Signing | `True/False` |
| Guest access | `Yes/No` |
| Null session | `Yes/No` |
| Readable shares | `SYSVOL, Shared, IT` |
| Interesting files | `scripts, configs, backups` |

---

## LDAP Enumeration

LDAP enumeration reads directory data.

Without credentials, LDAP may still expose RootDSE and sometimes more if anonymous bind is allowed.

Basic RootDSE query:

```bash
ldapsearch -x -H ldap://$DC_IP -s base
```

More useful RootDSE query:

```bash
ldapsearch -x -H ldap://$DC_IP -s base +
```

Specific RootDSE fields:

```bash
ldapsearch -x -H ldap://$DC_IP -s base defaultNamingContext rootDomainNamingContext configurationNamingContext schemaNamingContext dnsHostName
```

If anonymous LDAP is allowed, try basic object queries:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=user)" sAMAccountName
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=computer)" dNSHostName
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(objectClass=group)" cn
```

Authenticated LDAP query:

```bash
ldapsearch -x -H ldap://$DC_IP -D 'CORP\\alice' -w 'Password123!' -b "DC=corp,DC=local"
```

LDAPS:

```bash
ldapsearch -x -H ldaps://$DC_IP -D 'CORP\\alice' -w 'Password123!' -b "DC=corp,DC=local"
```

Useful LDAP filters:

| Goal | Filter |
| --- | --- |
| Users | `(&(objectCategory=person)(objectClass=user))` |
| Computers | `(objectClass=computer)` |
| Groups | `(objectClass=group)` |
| Domain Controllers | `(&(objectCategory=computer)(userAccountControl:1.2.840.113556.1.4.803:=8192))` |
| Users with SPNs | `(&(objectClass=user)(servicePrincipalName=*))` |
| Disabled accounts | `(userAccountControl:1.2.840.113556.1.4.803:=2)` |
| Password never expires | `(userAccountControl:1.2.840.113556.1.4.803:=65536)` |
| No pre-auth required | `(userAccountControl:1.2.840.113556.1.4.803:=4194304)` |

Useful attributes:

```text
sAMAccountName
userPrincipalName
distinguishedName
memberOf
member
description
servicePrincipalName
dNSHostName
operatingSystem
pwdLastSet
lastLogonTimestamp
userAccountControl
objectSid
```

NetExec LDAP examples:

```bash
nxc ldap $DC_IP -u '' -p ''
nxc ldap $DC_IP -u guest -p ''
nxc ldap $DC_IP -u alice -p 'Password123!' -d CORP
```

Useful LDAP output to save:

| Field | Why it matters |
| --- | --- |
| Domain DN | Needed for LDAP queries. |
| DC hostname | Helps with `/etc/hosts`. |
| Usernames | Input for later auth checks. |
| Computers | Host inventory. |
| Groups | Privilege structure. |
| SPNs | Service account context. |
| Descriptions | Sometimes reveal role or naming patterns. |
| Password policy | Helps understand safe testing limits. |

---

## RPC Enumeration

RPC enumeration can expose domain and host information through Windows RPC interfaces.

The most common tool is `rpcclient`.

Null session:

```bash
rpcclient -U "" -N $TARGET
```

Guest:

```bash
rpcclient -U "guest%" $TARGET
```

Authenticated:

```bash
rpcclient -U "CORP\\alice%Password123!" $TARGET
```

Useful `rpcclient` commands:

| Command | Purpose |
| --- | --- |
| `srvinfo` | Server information. |
| `enumdomusers` | Enumerate domain users. |
| `enumdomgroups` | Enumerate domain groups. |
| `enumalsgroups builtin` | Enumerate builtin alias groups. |
| `querydominfo` | Domain information. |
| `lsaquery` | LSA/domain SID information. |
| `lookupnames username` | Resolve name to SID. |
| `lookupsids SID` | Resolve SID to name. |
| `queryuser RID` | Query user by RID. |
| `querygroup RID` | Query group by RID. |
| `querygroupmem RID` | Query group members. |
| `getdompwinfo` | Domain password policy info. |

Example session:

```bash
rpcclient -U "" -N $TARGET
rpcclient $> srvinfo
rpcclient $> querydominfo
rpcclient $> enumdomusers
rpcclient $> enumdomgroups
rpcclient $> lsaquery
```

One-liners:

```bash
rpcclient -U "" -N $TARGET -c "srvinfo"
rpcclient -U "" -N $TARGET -c "querydominfo"
rpcclient -U "" -N $TARGET -c "enumdomusers"
rpcclient -U "" -N $TARGET -c "enumdomgroups"
rpcclient -U "" -N $TARGET -c "lsaquery"
```

RID cycling can reveal users and groups if allowed:

```bash
for rid in $(seq 500 1500); do
  rpcclient -U "" -N $TARGET -c "lookupsids S-1-5-21-1111111111-2222222222-3333333333-$rid" 2>/dev/null | grep -v unknown
done
```

With NetExec:

```bash
nxc smb $TARGET --rid-brute
nxc smb $TARGET -u '' -p '' --rid-brute
nxc smb $TARGET -u guest -p '' --rid-brute
```

`enum4linux-ng` is useful for combined SMB/RPC enumeration:

```bash
enum4linux-ng -A $TARGET
enum4linux-ng -A -u '' -p '' $TARGET
```

Record:

| Finding | Why it matters |
| --- | --- |
| Domain SID | Useful for RID cycling and SID interpretation. |
| User list | Input for later checks. |
| Group list | Helps understand privilege structure. |
| Password policy | Important before any password testing. |
| Server info | OS and role context. |
| Null/guest RPC | Weak exposure and useful lab foothold. |

---

## Kerberos Enumeration

Kerberos enumeration is useful when port `88` is open.

It can help identify the Kerberos realm and valid usernames.

Kerberos user enumeration often relies on different KDC responses for valid and invalid principals.

Typical responses:

| Response | Meaning |
| --- | --- |
| `KDC_ERR_C_PRINCIPAL_UNKNOWN` | User probably does not exist. |
| `KDC_ERR_PREAUTH_REQUIRED` | User exists and requires pre-authentication. |
| AS-REP returned | User exists and pre-authentication may be disabled. |
| Lockout-related error | User exists but account may be locked or restricted. |

Kerbrute user enumeration:

```bash
kerbrute userenum --dc $DC_IP -d $DOMAIN users.txt
```

With threads:

```bash
kerbrute userenum --dc $DC_IP -d $DOMAIN users.txt -t 10
```

Save output:

```bash
kerbrute userenum --dc $DC_IP -d $DOMAIN users.txt -o kerbrute_users.txt
```

Nmap Kerberos username script:

```bash
nmap -Pn -n -p88 --script krb5-enum-users --script-args krb5-enum-users.realm='CORP.LOCAL',userdb=users.txt $DC_IP
```

Impacket lookupsid may help when SMB/RPC exposes SID data:

```bash
lookupsid.py anonymous@$DC_IP -no-pass
```

AS-REP check belongs conceptually to unauthenticated AD attacks, but during recon it is useful to note accounts that return AS-REP instead of pre-auth required.

Safe recon command shape:

```bash
GetNPUsers.py $DOMAIN/ -usersfile users.txt -dc-ip $DC_IP -no-pass
```

Important notes:

| Note | Why it matters |
| --- | --- |
| Kerberos is time-sensitive | Local clock skew can cause misleading failures. |
| Realm is usually uppercase domain | `corp.local` becomes `CORP.LOCAL`. |
| User enum is not password spraying | It checks username validity, not passwords. |
| Error messages matter | Different KDC errors reveal different states. |
| Use a clean wordlist | Bad input creates noisy output. |

Check local time if Kerberos behaves strangely:

```bash
date
ntpdate -q $DC_IP
```

In labs, syncing time may help:

```bash
sudo ntpdate $DC_IP
```

---

## User Enumeration

User enumeration builds a list of possible valid usernames.

Good username lists are important because many later AD checks depend on valid user principals.

Common username sources:

| Source | Examples |
| --- | --- |
| SMB null or guest | Share names, files, session info, domain info. |
| RPC enum | `enumdomusers`, RID cycling. |
| LDAP anonymous | `sAMAccountName`, `userPrincipalName`. |
| Kerberos | Valid/invalid principal responses. |
| DNS | Hostnames and naming conventions. |
| Web apps | Emails, authors, login pages, staff pages. |
| Documents | Metadata, usernames, email addresses. |
| Shares | Scripts, home folders, profile folders. |
| Git repos | Commit authors, config files, docs. |
| Email format | `first.last`, `flast`, `firstl`, etc. |

Common username formats:

```text
alice
asmith
alice.smith
alice_smith
a.smith
alices
smitha
alice@corp.local
```

Create usernames from names with username-anarchy:

```bash
username-anarchy -i names.txt > users.txt
```

Example `names.txt`:

```text
Alice Smith
Bob Johnson
Charlie Brown
```

Clean username list:

```bash
cat users.txt | tr '[:upper:]' '[:lower:]' | sort -u > users_clean.txt
```

Extract possible usernames from files:

```bash
grep -RhoEi "[a-z0-9._%+-]+@$DOMAIN" . | sort -u
grep -RhoEi "\\b[a-z][a-z0-9._-]{2,30}\\b" . | sort -u
```

Validate usernames with Kerberos:

```bash
kerbrute userenum --dc $DC_IP -d $DOMAIN users_clean.txt -o valid_users.txt
```

Clean Kerbrute output into a simple list:

```bash
grep -i "VALID USERNAME" valid_users.txt | awk '{print $NF}' | sed 's/@.*//' | sort -u > confirmed_users.txt
```

If RPC allows user enumeration:

```bash
rpcclient -U "" -N $DC_IP -c "enumdomusers" | tee rpc_users.txt
cat rpc_users.txt | grep -oP '\\[.*?\\]' | tr -d '[]' | sort -u
```

If LDAP allows user enumeration:

```bash
ldapsearch -x -H ldap://$DC_IP -b "DC=corp,DC=local" "(&(objectCategory=person)(objectClass=user))" sAMAccountName userPrincipalName
```

If SMB reveals home directories:

```bash
smbclient //$DC_IP/Users -N -c 'ls'
```

Username list quality checks:

| Check | Why it matters |
| --- | --- |
| Remove duplicates | Avoid noise. |
| Normalize case | AD usernames are usually case-insensitive. |
| Keep UPNs separately | Some tools accept UPNs better than short names. |
| Remove machine accounts if needed | Computer accounts end with `$`. |
| Track source | Useful for confidence and reporting. |
| Separate guessed vs confirmed | Avoid mixing assumptions with validated users. |
