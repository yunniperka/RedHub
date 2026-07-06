## Core AD Enumeration and Graphing

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **PowerView.ps1** | [GitHub ↗](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1) | Classic PowerShell tool for AD enumeration. | Users, groups, computers, GPOs, ACLs, delegation, sessions, local admin access, trusts. |
| **SharpView.exe** | [GitHub ↗](https://github.com/tevora-threat/SharpView) | C# port of PowerView. | Similar use cases to PowerView, but as a .NET assembly. |
| **ADModule.dll** | [GitHub ↗](https://github.com/samratashok/ADModule) | Microsoft Active Directory PowerShell module without installing RSAT. | `Get-ADUser`, `Get-ADGroup`, `Get-ADComputer`, `Get-ADObject`, domain and object enumeration. |
| **SharpHound.exe / SharpHound.ps1** | [GitHub ↗](https://github.com/SpecterOps/SharpHound) | Data collector for BloodHound. | Collects groups, sessions, local admin rights, ACLs, trusts, GPOs, OUs, and AD objects. |
| **SharpHound Legacy** | [GitHub ↗](https://github.com/SpecterOps/SharpHound) | Older collector for classic BloodHound. | Useful in older labs, but current SharpHound CE is preferred. |
| **BloodHound** | [GitHub ↗](https://github.com/SpecterOps/BloodHound) | Graph-based AD attack path analysis. | Attack paths, shortest paths, group nesting, ACL abuse, session paths, local admin paths, trusts. |
| **BloodHound.py** | [GitHub ↗](https://github.com/dirkjanm/BloodHound.py) | Linux collector compatible with BloodHound. | LDAP/SMB collection from Linux, useful without a Windows foothold. |
| **RustHound CE** | [GitHub ↗](https://github.com/g0h4n/RustHound-CE) | Alternative BloodHound CE collector. | AD data collection from Linux, focused on BloodHound CE. |

## Multi-Protocol AD Toolkits

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **NetExec / nxc** | [GitHub ↗](https://github.com/Pennyw0rth/NetExec) | Main tool for enumeration and access validation over SMB, LDAP, WinRM, MSSQL, RDP, and more. | Spraying, authentication checks, shares, users, groups, local admin checks, sessions, BloodHound collection, Kerberoasting, ASREP roasting, gMSA, AD CS modules. |
| **CrackMapExec Legacy** | [GitHub ↗](https://github.com/byt3bl33d3r/CrackMapExec) | Older predecessor of NetExec. | Similar workflow to NetExec, but treat it as legacy. |
| **Impacket** | [GitHub ↗](https://github.com/fortra/impacket) | Protocol toolkit for AD and Windows environments. | `secretsdump`, `psexec`, `wmiexec`, `smbexec`, `atexec`, `GetUserSPNs`, `GetNPUsers`, `getTGT`, `getST`, `ntlmrelayx`, `ticketer`, `lookupsid`. |
| **BloodyAD** | [GitHub ↗](https://github.com/CravateRouge/bloodyAD) | Python tool for AD object modification and abuse. | ACL abuse, password changes, group membership changes, shadow credentials, attribute modification. |
| **Windows Built-ins** | Microsoft built-in | Native Windows tools without extra downloads. | `net`, `nltest`, `setspn`, `dsquery`, `whoami`, `klist`, `sc`, `schtasks`, `reg`, `wmic`, PowerShell AD module. |

## LDAP, SMB, RPC and DNS Enumeration

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **LDAP Search Filters** | note / cheatsheet | Not a tool, but a reusable set of LDAP filters. | Filters for users, computers, groups, SPNs, no-preauth users, delegation, LAPS, gMSA, AD CS, ACL-related attributes. |
| **ldapdomaindump** | [GitHub ↗](https://github.com/dirkjanm/ldapdomaindump) | Dumps domain information through LDAP into readable files. | Users, groups, computers, memberships, domain policy, HTML/JSON/grep-friendly output. |
| **enum4linux-ng** | [GitHub ↗](https://github.com/cddmp/enum4linux-ng) | SMB/RPC enumeration from Linux. | Null/guest checks, users, groups, shares, password policy, OS/domain information. |
| **rpcclient** | Samba suite | RPC client included with Samba. | `enumdomusers`, `enumdomgroups`, `queryuser`, `lsaquery`, `getdompwinfo`, RID cycling. |
| **smbclient** | Samba suite | SMB client from Linux. | List shares, download files, test null/guest/authenticated access. |
| **dnsrecon** | [GitHub ↗](https://github.com/darkoperator/dnsrecon) | DNS enumeration. | SRV records, zones, brute force, zone transfer checks, AD DNS discovery. |
| **CheckPort.exe** | local utility | Helper utility, not strictly AD-specific. | Quick port checks from a Windows foothold. In AD notes, treat it as a utility, not a main AD tool. |

## Kerberos and Ticket Abuse

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **Rubeus.exe / Rubeus-2.exe** | [GitHub ↗](https://github.com/GhostPack/Rubeus) | Main C# Kerberos tool for AD. | ASREP roasting, Kerberoasting, TGT/TGS handling, S4U, Pass the Ticket, Overpass the Hash, golden/silver/diamond tickets, ticket triage. |
| **SharpRoast.exe** | [GitHub ↗](https://github.com/GhostPack/Rubeus) | Older or standalone roasting builds, usually replaced by Rubeus. | Kerberoasting and ASREP roasting in older workflows. |
| **Kerbrute** | [GitHub ↗](https://github.com/ropnop/kerbrute) | Kerberos username enumeration and password spraying. | User enumeration without SMB, Kerberos password spraying, fast username validation. |
| **Kekeo** | [GitHub ↗](https://github.com/gentilkiwi/kekeo) | Advanced Kerberos operations. | TGT/TGS handling, S4U, ticket manipulation, Kerberos research. |
| **noPac.exe** | [GitHub ↗](https://github.com/Ridter/noPac) | Abuse of CVE-2021-42278 and CVE-2021-42287 in vulnerable domains. | sAMAccountName spoofing, KDC confusion, privilege escalation in unpatched environments. |
| **KrbRelay.exe** | [GitHub ↗](https://github.com/cube0x0/KrbRelay) | Kerberos relay in specific scenarios. | Kerberos/LDAP relay, used in machine account and local privesc chains. |
| **KrbRelayUp.exe** | [GitHub ↗](https://github.com/Dec0ne/KrbRelayUp) | Automated local privesc chain in domain environments through Kerberos relay. | Machine account, LDAP relay, RBCD/service creation chain depending on conditions. |

## AD CS and Certificate Abuse

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **Certipy** | [GitHub ↗](https://github.com/ly4k/Certipy) | Main Linux tool for AD CS. | CA/template enumeration, ESC1-ESC16 checks, relay output, shadow credentials, certificate authentication, template analysis. |
| **Certify.exe** | [GitHub ↗](https://github.com/GhostPack/Certify) | C# tool for AD CS enumeration and abuse. | Find CAs, templates, vulnerable templates, request certificates. |
| **ForgeCert.exe** | [GitHub ↗](https://github.com/GhostPack/ForgeCert) | Certificate forging in AD CS scenarios. | Forged certificates and CA private key abuse scenarios. |
| **PassTheCert** | [GitHub ↗](https://github.com/AlmondOffSec/PassTheCert) | Use a certificate for LDAP/S over Schannel when PKINIT does not work. | LDAP authentication with a certificate, LDAP modifications, shadow/cert-based workflows. |
| **Whisker.exe** | [GitHub ↗](https://github.com/eladshamir/Whisker) | Shadow Credentials from Windows/C#. | Add, list, and remove `msDS-KeyCredentialLink`; certificate-based persistence/authentication. |
| **PKINITtools** | [GitHub ↗](https://github.com/dirkjanm/PKINITtools) | PKINIT and certificate authentication tooling. | `gettgtpkinit.py`, TGT from certificate, U2U, NT hash recovery in selected paths. |

## NTLM Relay, Poisoning and Coercion

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **ntlmrelayx.py** | [GitHub ↗](https://github.com/fortra/impacket) | NTLM relay to SMB/LDAP/HTTP/AD CS. | SMB relay, LDAP relay, RBCD, add-computer, AD CS relay, SOCKS sessions. |
| **Responder** | [GitHub ↗](https://github.com/lgandx/Responder) | LLMNR/NBT-NS/WPAD poisoning and NetNTLM capture. | Hash capture, poisoning, lab initial access; watch for conflicts with `ntlmrelayx`. |
| **Inveigh.ps1** | [GitHub ↗](https://github.com/Kevin-Robertson/Inveigh) | PowerShell/.NET poisoning and capture tool for Windows. | LLMNR/NBNS/mDNS poisoning, HTTP/SMB authentication capture, Windows-side Responder-like workflow. |
| **SpoolSample.exe** | [GitHub ↗](https://github.com/leechristensen/SpoolSample) | PrinterBug / MS-RPRN coercion. | Forces a machine to authenticate to a chosen listener. |
| **Coercer** | [GitHub ↗](https://github.com/p0dalirius/Coercer) | Automatic testing of many RPC coercion primitives. | PrinterBug, PetitPotam-like methods, DFSCoerce, ShadowCoerce-like paths, reporting working methods. |
| **PetitPotam** | [GitHub ↗](https://github.com/topotam/PetitPotam) | MS-EFSRPC coercion. | Forces authentication from a host/machine, often combined with AD CS relay. |
| **DFSCoerce** | [GitHub ↗](https://github.com/Wh04m1001/DFSCoerce) | MS-DFSNM coercion. | Forces machine account authentication through DFS Namespace RPC. |
| **ShadowCoerce** | [GitHub ↗](https://github.com/ShutdownRepo/ShadowCoerce) | MS-FSRVP coercion. | Forces authentication through File Server Remote VSS Protocol. |
| **mitm6** | [GitHub ↗](https://github.com/dirkjanm/mitm6) | IPv6 DNS takeover / relay setup. | WPAD/IPv6-based authentication capture/relay, often combined with `ntlmrelayx`. |

## Credential Access and Secret Hunting

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **Mimikatz.exe** | [GitHub ↗](https://github.com/gentilkiwi/mimikatz) | Classic credential access and Kerberos tool. | LSASS, `sekurlsa`, tickets, DCSync, Golden Ticket, Skeleton Key, DPAPI. |
| **SafetyKatz.exe** | [GitHub ↗](https://github.com/GhostPack/SafetyKatz) | Mimikatz wrapper/variant with minidump workflow. | Credential dumping from LSASS dump, convenient in .NET/offensive workflows. |
| **BetterSafetyKatz.exe** | [GitHub ↗](https://github.com/Flangvik/BetterSafetyKatz) | Alternative SafetyKatz wrapper/build. | Similar purpose: Mimikatz-like credential extraction with easier staging. |
| **SharpDump.exe** | [GitHub ↗](https://github.com/GhostPack/SharpDump) | LSASS dump from .NET. | Creates LSASS minidumps for offline parsing. |
| **pypykatz** | [GitHub ↗](https://github.com/skelsec/pypykatz) | Offline LSASS dump parsing. | NTLM, Kerberos tickets, DPAPI material, logon sessions. |
| **SharpDPAPI.exe** | [GitHub ↗](https://github.com/GhostPack/SharpDPAPI) | DPAPI triage and decryption workflow. | Credentials, vaults, browser-related DPAPI secrets, masterkeys, domain backup key workflows. |
| **SharpChrome.exe** | [GitHub ↗](https://github.com/GhostPack/SharpDPAPI) | Browser credential/cookie extraction, related to SharpDPAPI. | Chrome/Edge logins, cookies, history; depends on DPAPI context. |
| **DonPAPI** | [GitHub ↗](https://github.com/login-securite/DonPAPI) | Collect DPAPI/secrets from many Windows hosts. | Browser creds, Wi-Fi, CredMan, vaults, certificates, remote collection. |
| **KeeTheft.exe / KeeThief** | [GitHub ↗](https://github.com/GhostPack/KeeThief) | KeePass hunting and key extraction scenarios. | KeePass database discovery, key material, password vault abuse in labs. |
| **Koh.exe** | [GitHub ↗](https://github.com/GhostPack/Koh) | Token stealing / token monitoring. | Token capture/stealing in Windows sessions; useful when admin sessions appear. |
| **LockLess.exe** | [GitHub ↗](https://github.com/GhostPack/LockLess) | Read files locked by processes. | Helpful for copying browser databases, logs, and other locked files. |
| **Snaffler.exe** | [GitHub ↗](https://github.com/SnaffCon/Snaffler) | Search for secrets on domain shares. | Recursive SMB share searching, rules for passwords, configs, keys, `.kdbx`, connection strings. |
| **LaZagne** | [GitHub ↗](https://github.com/AlessandroZ/LaZagne) | Local credential recovery. | Browser creds, Wi-Fi, apps, credential stores; useful after host access. |

## ACL, GPO, Machine Accounts and Object Abuse

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **PowerView.ps1** | [GitHub ↗](https://github.com/PowerShellMafia/PowerSploit/blob/master/Recon/PowerView.ps1) | ACL/GPO/OU enumeration and abuse. | `Find-InterestingDomainAcl`, `Get-DomainObjectAcl`, `Add-DomainObjectAcl`, GPO/OU mapping. |
| **Powermad.ps1** | [GitHub ↗](https://github.com/Kevin-Robertson/Powermad) | Machine account manipulation. | Add machine accounts, modify machine account attributes, useful in RBCD/KrbRelayUp paths. |
| **SharpMad.exe / Sharpmad.exe** | [GitHub ↗](https://github.com/Kevin-Robertson/SharpMad) | C# variant of Powermad. | Machine account creation/modification as a .NET assembly. |
| **SharpGPOAbuse.exe** | [GitHub ↗](https://github.com/FSecureLABS/SharpGPOAbuse) | Abuse writable GPOs. | Add local admin, scheduled task, startup/logon actions, GPO persistence/lateral movement. |
| **SharpGPO.exe** | [GitHub ↗](https://github.com/FSecureLABS/SharpGPOAbuse) | Often a build/variant used in GPO abuse workflows. | GPO manipulation; verify exact build because the name is used inconsistently. |
| **GPOddity** | [GitHub ↗](https://github.com/synacktiv/GPOddity) | Additional GPO abuse tool. | Create/modify GPOs with focus on offensive GPO workflows. |
| **BloodyAD** | [GitHub ↗](https://github.com/CravateRouge/bloodyAD) | LDAP object abuse from Linux. | Password reset, group add, shadow credentials, ACL/object modifications. |

## LAPS and gMSA

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **LAPSToolkit.ps1** | [GitHub ↗](https://github.com/leoloobeek/LAPSToolkit) | Microsoft LAPS audit and abuse. | Find LAPS-enabled computers, delegated password readers, groups with LAPS read rights. |
| **SharpLAPS.exe** | [GitHub ↗](https://github.com/swisskyrepo/SharpLAPS) | C# tool to read LAPS from LDAP. | Retrieves `ms-Mcs-AdmPwd` when the account has the required rights. |
| **pyLAPS** | [GitHub ↗](https://github.com/p0dalirius/pyLAPS) | Linux getter/setter for legacy LAPS attributes. | Reads and modifies `ms-Mcs-AdmPwd` if permissions allow it. |
| **GMSAPasswordReader.exe** | [GitHub ↗](https://github.com/rvazarkar/GMSAPasswordReader) | Read and parse gMSA passwords. | Retrieves the gMSA blob through LDAP and calculates reusable material. |
| **gMSADumper** | [GitHub ↗](https://github.com/micahvandeusen/gMSADumper) | Linux tool for gMSA. | Reads gMSA password material, NTLM, AES keys, Kerberos/PTH support. |

## AD CS, ADFS, Exchange, MSSQL and SCCM

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **PowerUpSQL.ps1** | [GitHub ↗](https://github.com/NetSPI/PowerUpSQL) | SQL Server discovery and abuse in AD. | SQL discovery, login testing, linked servers, impersonation, xp_cmdshell, SQL privilege escalation. |
| **SharpSQL.exe** | [GitHub ↗](https://github.com/Flangvik/SharpCollection) | C# SQL tooling build commonly seen in collections. | SQL enumeration and execution; exact functionality depends on the specific build. |
| **SharpSCCM.exe** | [GitHub ↗](https://github.com/Mayyhem/SharpSCCM) | SCCM/MECM enumeration and abuse. | Site discovery, collections, deployments, client push, SCCM attack paths. |
| **SCCMHunter** | [GitHub ↗](https://github.com/garrettfoster13/sccmhunter) | Linux SCCM recon/attack toolkit. | SCCM discovery, credential paths, shares, policies, admin relationships. |
| **ADFSDump.exe** | [GitHub ↗](https://github.com/mandiant/ADFSDump) | AD FS configuration and token signing material discovery. | Reads AD and AD FS config database data needed for forged token scenarios. |
| **ADFSpoof** | [GitHub ↗](https://github.com/mandiant/ADFSpoof) | Companion tool for ADFSDump. | Creates forged SAML tokens from data collected with ADFSDump. |
| **Exchange tools / PowerShell** | Microsoft / Exchange shell | No single GitHub repository; used through Exchange Management Shell. | Role groups, mailbox permissions, organization management, Exchange Windows Permissions checks. |

## Lateral Movement and Remote Execution

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **SharpMove.exe** | [GitHub ↗](https://github.com/0xthirteen/SharpMove) | .NET remote execution toolkit. | WMI, SCM, scheduled tasks, DCOM-style movement, authenticated remote execution. |
| **SharpRDP.exe** | [GitHub ↗](https://github.com/0xthirteen/SharpRDP) | RDP-based authenticated command execution. | RDP automation and remote process execution through an RDP context. |
| **SharpWMI.exe** | [GitHub ↗](https://github.com/GhostPack/SharpWMI) | C# WMI query/execution toolkit. | Local/remote WMI queries, process creation, WMI event subscriptions, alternate credentials. |
| **RunasCs.exe** | [GitHub ↗](https://github.com/antonioCoco/RunasCs) | Runas alternative with more flexible logon types. | Run a process as another user, network credentials, reverse shell usage in labs. |
| **RestrictedAdmin.exe** | [GitHub ↗](https://github.com/GhostPack/RestrictedAdmin) | Restricted Admin mode helper. | RDP/PTH-related workflow, checking and setting Restricted Admin in labs. |
| **Impacket psexec/wmiexec/smbexec/atexec** | [GitHub ↗](https://github.com/fortra/impacket) | Remote execution from Linux. | SMB service execution, WMI execution, scheduled task execution, Kerberos/PTH support. |
| **Evil-WinRM** | [GitHub ↗](https://github.com/Hackplayers/evil-winrm) | Interactive WinRM shell. | WinRM shell, upload/download, pass-the-hash, certificate authentication in selected workflows. |

## Local Windows Privesc Supporting AD Chains

These tools are not strictly AD tools, but they often matter in AD attack chains because local SYSTEM/admin access on domain-joined hosts can lead to admin sessions, tokens, LSASS, DPAPI, SCCM, backups, or lateral movement.

| Tool | Link | Purpose | Functionality |
| --- | --- | --- | --- |
| **PowerUp.ps1** | [GitHub ↗](https://github.com/PowerShellMafia/PowerSploit/blob/master/Privesc/PowerUp.ps1) | Windows local privilege escalation checks. | Services, permissions, AlwaysInstallElevated, modifiable paths, misconfiguration checks. |
| **SharpUp.exe** | [GitHub ↗](https://github.com/GhostPack/SharpUp) | C# port of parts of PowerUp. | Basic privilege escalation checks as a .NET assembly. |
| **Seatbelt.exe** | [GitHub ↗](https://github.com/GhostPack/Seatbelt) | Host survey. | Local security checks, sessions, environment, installed software, credential-related context. |
| **winPEAS.exe** | [GitHub ↗](https://github.com/peass-ng/PEASS-ng) | Automated local Windows enumeration. | Privileges, services, credentials, files, registry, scheduled tasks, AV checks. |
| **JuicyPotato.exe** | [GitHub ↗](https://github.com/ohpe/juicy-potato) | Local privesc through token/COM paths on older Windows. | Abuse of `SeImpersonatePrivilege` / `SeAssignPrimaryTokenPrivilege` in vulnerable configurations. |
| **PrintSpoofer64.exe** | [GitHub ↗](https://github.com/itm4n/PrintSpoofer) | Local privesc through named pipe impersonation. | `SeImpersonatePrivilege` to SYSTEM in vulnerable conditions. |
| **GodPotato.exe** | [GitHub ↗](https://github.com/BeichenDream/GodPotato) | Potato-family local privesc. | DCOM/NTLM local privilege escalation paths. |
| **SweetPotato.exe** | [GitHub ↗](https://github.com/CCob/SweetPotato) | Potato-family local privesc. | Rotten/Juicy/PrintSpoofer-like variants. |
| **SharpEfsPotato.exe** | [GitHub ↗](https://github.com/bugch3ck/SharpEfsPotato) | Local privesc through EFSRPC-related abuse. | `SeImpersonatePrivilege` style chain on selected systems. |

## Legacy, Duplicates and Use With Caution

| Tool | Link | Status | Notes |
| --- | --- | --- | --- |
| **CrackMapExec_Legacy / crackmapexec.py** | [GitHub ↗](https://github.com/byt3bl33d3r/CrackMapExec) | Legacy | Prefer NetExec in new notes. Keep CME for older labs and writeups. |
| **SharpHound_Legacy.exe** | [GitHub ↗](https://github.com/SpecterOps/SharpHound) | Legacy | Use only if an older BloodHound/lab requires it. |
| **Rubeus-2.exe** | [GitHub ↗](https://github.com/GhostPack/Rubeus) | Duplicate/build variant | Treat as a Rubeus variant and document under one Rubeus note. |
| **SafetyKatz / BetterSafetyKatz / Mimikatz** | [GitHub ↗](https://github.com/gentilkiwi/mimikatz) | Related family | Do not create three separate main categories; this is the Mimikatz/credential access family. |
| **SharpChrome / SharpDPAPI** | [GitHub ↗](https://github.com/GhostPack/SharpDPAPI) | Related family | Best documented together under DPAPI/browser credentials. |
| **SharpGPO / SharpGPOAbuse** | [GitHub ↗](https://github.com/FSecureLABS/SharpGPOAbuse) | Related family | In AD notes, the important part is GPO abuse, not the exact build name. |