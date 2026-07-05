# AD Fundamentals

## Introduction

Active Directory is Microsoft's directory service for Windows domain environments.

It is used to centrally manage identities, computers, groups, policies, permissions, services, and relationships between systems. In many internal networks, Active Directory is the main source of truth for who exists, what machines belong to the environment, and which identities can access which resources.

For pentest labs, HTB, THM, and internal assessments, AD is important because it is rarely just one machine. It is a connected environment where users, computers, groups, sessions, services, tickets, policies, DNS records, and permissions all interact with each other.

### Useful Resources

- [HackTricks - Active Directory Methodology](https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/index.html)
- [The Hacker Recipes - Active Directory](https://www.thehacker.recipes/ad/)
- [ired.team - Active Directory & Kerberos Abuse](https://www.ired.team/offensive-security-experiments/active-directory-kerberos-abuse)
- [PayloadsAllTheThings - Active Directory Attacks](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/Methodology%20and%20Resources/Active%20Directory%20Attack.md)
- [Microsoft Learn - Active Directory Domain Services Overview](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview)
- [Microsoft Learn - Kerberos Authentication Overview](https://learn.microsoft.com/en-us/windows-server/security/kerberos/kerberos-authentication-overview)
- [Microsoft Learn - NTLM Overview](https://learn.microsoft.com/en-us/windows-server/security/kerberos/ntlm-overview)
- [Microsoft Learn - LDAP / AD Technical Specification](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/)
- [WADComs](https://wadcoms.github.io/)

### Domain

A domain is a logical administrative and security boundary.

It contains identities, computers, groups, policies, and configuration. Systems that belong to the domain can use domain accounts for authentication and can apply centralized policy from the domain.

Example domain names:

```text
corp.local
ad.company.com
internal.lab
```

A domain usually has several names depending on where it is seen:

| Name type | Example |
| --- | --- |
| DNS name | `corp.local` |
| NetBIOS name | `CORP` |
| LDAP base DN | `DC=corp,DC=local` |
| Kerberos realm | `CORP.LOCAL` |

The same domain may appear in commands, logs, LDAP paths, tickets, and tools using different formats.

Example identity formats:

```text
CORP\alice
alice@corp.local
corp.local/alice
CN=Alice,OU=Users,DC=corp,DC=local
```

These can all refer to the same user depending on the protocol or context.

A domain contains objects such as:

- users
- computers
- groups
- OUs
- GPOs
- service accounts
- domain controllers
- DNS zones
- trust objects
- certificate services objects

In small labs, the environment is often a single domain. In larger networks, there may be multiple domains connected by trusts.

### Forest and Tree

A forest is the highest-level Active Directory boundary.

A forest can contain one domain or many domains.

Example:

```text
corp.local
├── dev.corp.local
├── sales.corp.local
└── lab.corp.local
```

All domains in the same forest share some forest-wide components.

| Forest component | Meaning |
| --- | --- |
| Schema | Defines object classes and attributes. |
| Configuration partition | Stores forest-wide configuration. |
| Global Catalog | Allows searching objects across the forest. |
| Trust relationships | Connect domains inside the forest. |
| Enterprise-level groups | Groups with forest-wide meaning, such as Enterprise Admins. |

In a single-domain lab, the forest may not be very visible. In enterprise networks, forest boundaries matter because they define where some privileges and trusts apply.

A tree is a group of domains that share a contiguous DNS namespace.

Example:

```text
corp.local
├── it.corp.local
└── finance.corp.local
```

The child domains are part of the same DNS namespace as the parent domain.

Another forest can contain more than one tree.

Example:

```text
corp.local
research.local
```

Both trees can exist in the same forest, but they do not share the same DNS namespace.

In practice, the term forest is usually more important during pentest work than the term tree, because forest boundaries and trusts are more relevant than the tree definition itself.

### Domain Controller

A Domain Controller, or DC, is a Windows server that runs Active Directory Domain Services.

The DC stores and replicates directory data and provides core domain services.

Common DC functions:

| Function | Meaning |
| --- | --- |
| Authentication | Validates users and computers. |
| Kerberos KDC | Issues Kerberos tickets. |
| LDAP service | Allows directory queries. |
| DNS service | Often hosts AD-integrated DNS zones. |
| SYSVOL | Shares policy and logon script data. |
| NETLOGON | Supports logon-related domain functions. |
| Replication | Synchronizes AD data with other DCs. |
| Global Catalog | May provide forest-wide object lookup. |

Typical DC-related ports:

| Port | Service |
| --- | --- |
| `53` | DNS |
| `88` | Kerberos |
| `135` | RPC Endpoint Mapper |
| `139` | NetBIOS Session Service |
| `389` | LDAP |
| `445` | SMB |
| `464` | Kerberos password change |
| `636` | LDAPS |
| `3268` | Global Catalog LDAP |
| `3269` | Global Catalog LDAPS |
| `5985` | WinRM |
| `9389` | Active Directory Web Services |

A DC is a high-value system because it participates in authentication, stores domain data, and usually has access to sensitive domain material.

### Active Directory Database

The main AD database file on a domain controller is:

```text
NTDS.dit
```

It contains directory objects and many security-relevant attributes.

Conceptually, the AD database stores:

- user objects
- computer objects
- group objects
- password-related material
- group membership
- domain configuration
- trust information
- object attributes
- security descriptors
- replication metadata

The database is replicated between domain controllers.

This means a domain can continue working even if one DC is unavailable, and changes made on one DC can be synchronized to others.

### Naming Contexts

AD data is divided into naming contexts, also called partitions.

| Naming context | Purpose |
| --- | --- |
| Domain | Stores domain objects such as users, groups, and computers. |
| Configuration | Stores forest-wide configuration. |
| Schema | Defines object classes and attributes. |
| Application | Stores application-specific data, often DNS-related data. |

The domain naming context is the one most often seen during normal enumeration.

Example:

```text
DC=corp,DC=local
```

The configuration naming context is important for forest-wide settings.

Example:

```text
CN=Configuration,DC=corp,DC=local
```

The schema naming context defines what object types and attributes exist.

Example:

```text
CN=Schema,CN=Configuration,DC=corp,DC=local
```

### Schema

The schema defines what kinds of objects can exist in AD and what attributes those objects can have.

For example, the schema defines that:

- a user object can have `sAMAccountName`, `userPrincipalName`, `memberOf`, and `pwdLastSet`
- a computer object can have `dNSHostName`, `operatingSystem`, and `servicePrincipalName`
- a group object can have `member`, `groupType`, and `description`

Every object in AD is based on an object class.

Common object classes:

| Object class | Meaning |
| --- | --- |
| `user` | User or service account object. |
| `computer` | Domain-joined computer object. |
| `group` | Security or distribution group. |
| `organizationalUnit` | OU container. |
| `container` | Built-in AD container. |
| `groupPolicyContainer` | Group Policy Object stored in AD. |
| `trustedDomain` | Trust relationship object. |
| `pKIEnrollmentService` | AD CS Certification Authority object. |
| `pKICertificateTemplate` | Certificate template object. |

The schema is forest-wide. Changes to the schema affect the entire forest.

### Global Catalog

The Global Catalog, or GC, is a partial searchable copy of objects from all domains in a forest.

It helps clients and applications find objects across the forest without contacting every domain separately.

Common Global Catalog ports:

| Port | Service |
| --- | --- |
| `3268` | Global Catalog LDAP |
| `3269` | Global Catalog LDAPS |

In a single-domain lab, the Global Catalog can look similar to normal LDAP. In multi-domain environments, it becomes more useful because it can show objects from other domains in the forest.

The Global Catalog does not contain every attribute of every object. It contains a partial attribute set useful for searching and locating objects.

### Sites

An AD site represents network topology.

Sites are usually based on IP subnets and are used to control which domain controllers clients should use.

A site can represent:

- an office
- a datacenter
- a region
- a network location
- a group of well-connected subnets

Example:

```text
Domain: corp.local

Sites:
- Warsaw
- London
- Berlin
```

A site is not the same thing as a domain.

One domain can have many sites, and one site can contain systems from the same domain or multiple domains.

Sites matter because they influence:

- DC selection
- authentication locality
- replication behavior
- service discovery
- network-aware AD behavior

In small labs, site structure is often minimal. In enterprise networks, site structure can reveal how the environment is physically or logically organized.

### Objects and Attributes

An AD object is any entity stored in the directory.

Users, computers, groups, OUs, GPOs, service accounts, contacts, printers, and trust relationships are all represented as objects.

Each object has:

- an object class
- a name
- a location in the directory
- attributes
- a unique identifier
- permissions
- relationships with other objects

Example object types:

| Object type | Meaning |
| --- | --- |
| User | Human or service identity. |
| Computer | Domain-joined machine account. |
| Group | Collection of users, computers, or groups. |
| OU | Container used for organization and policy application. |
| GPO | Policy object linked to sites, domains, or OUs. |
| Contact | Address book object, usually not used for logon. |
| Trust object | Represents a trust with another domain. |
| Certificate template | AD CS object defining certificate enrollment behavior. |

Objects are important because most AD information is expressed as object data and object relationships.

Attributes are fields stored on an object.

Example user attributes:

| Attribute | Meaning |
| --- | --- |
| `sAMAccountName` | Legacy logon name. |
| `userPrincipalName` | Modern logon format, usually like an email address. |
| `displayName` | Display name. |
| `description` | Free-text description. |
| `memberOf` | Groups the object is directly a member of. |
| `pwdLastSet` | When the password was last changed. |
| `lastLogonTimestamp` | Approximate replicated logon timestamp. |
| `servicePrincipalName` | Service identifiers used by Kerberos. |
| `userAccountControl` | Bitmask controlling account behavior. |
| `adminCount` | Indicates whether privileged protection has applied to the object. |

Example computer attributes:

| Attribute | Meaning |
| --- | --- |
| `dNSHostName` | DNS hostname of the computer. |
| `operatingSystem` | Operating system name. |
| `operatingSystemVersion` | Operating system version. |
| `servicePrincipalName` | Services registered to the machine account. |
| `memberOf` | Groups the computer belongs to. |
| `lastLogonTimestamp` | Approximate replicated logon timestamp. |

Attributes are useful because they describe both identity and context.

A single attribute may reveal the object's purpose, role, naming convention, service usage, or relationship to other objects.

### Distinguished Names and Identifiers

A Distinguished Name, or DN, is the full LDAP path to an object.

Example:

```text
CN=Alice Smith,OU=Users,OU=Warsaw,DC=corp,DC=local
```

Read it from left to right:

| Part | Meaning |
| --- | --- |
| `CN=Alice Smith` | Object common name. |
| `OU=Users` | Parent OU. |
| `OU=Warsaw` | Higher parent OU. |
| `DC=corp,DC=local` | Domain components for `corp.local`. |

DNs show where an object lives in the directory tree.

Another example:

```text
CN=Domain Admins,CN=Users,DC=corp,DC=local
```

This means the `Domain Admins` group is located inside the built-in `Users` container in the `corp.local` domain.

The Common Name, or CN, is the name of the object inside its container.

Example:

```text
CN=Alice Smith
```

The CN is not always the same as the logon name.

Example:

| Field | Value |
| --- | --- |
| Common Name | `Alice Smith` |
| sAMAccountName | `asmith` |
| userPrincipalName | `alice.smith@corp.local` |

This matters because different tools and protocols may display a different identifier for the same account.

A Relative Distinguished Name, or RDN, is the leftmost part of a DN.

Example DN:

```text
CN=Alice Smith,OU=Users,DC=corp,DC=local
```

RDN:

```text
CN=Alice Smith
```

The RDN identifies the object relative to its parent container.

Domain Components, or DC parts, represent the DNS name of the domain in LDAP format.

Example:

```text
DC=corp,DC=local
```

means:

```text
corp.local
```

Another example:

```text
DC=ad,DC=company,DC=com
```

means:

```text
ad.company.com
```

This conversion appears constantly when moving between DNS names and LDAP queries.

The Object GUID is a globally unique identifier assigned to an AD object.

Example format:

```text
f3b7c2b4-8d2a-4a77-9a4f-7c9a1c2e8d10
```

Unlike names, the GUID remains stable if the object is renamed or moved.

Names are easier to read, but GUIDs are useful when correlating tool output, logs, LDAP results, and BloodHound data.

A Security Identifier, or SID, is the identifier Windows uses for security decisions.

Example SID:

```text
S-1-5-21-1111111111-2222222222-3333333333-1105
```

A domain SID is the shared prefix for objects in the domain.

Example domain SID:

```text
S-1-5-21-1111111111-2222222222-3333333333
```

The last number is the Relative Identifier, or RID.

Example RID:

```text
1105
```

Some well-known RIDs:

| RID | Common meaning |
| --- | --- |
| `500` | Built-in Administrator account. |
| `501` | Built-in Guest account. |
| `512` | Domain Admins group. |
| `513` | Domain Users group. |
| `514` | Domain Guests group. |
| `515` | Domain Computers group. |
| `516` | Domain Controllers group. |
| `519` | Enterprise Admins group. |

SIDs matter because permissions, access tokens, and group membership are ultimately based on SIDs, not friendly names.

### Users, Computers and Groups

A user object represents an account that can usually authenticate to the domain.

A user object may represent:

- a real person
- a service account
- an administrative account
- an application identity
- a test account
- a legacy account

Important user object fields:

| Field | Why it matters |
| --- | --- |
| `sAMAccountName` | Common username format. |
| `userPrincipalName` | Modern logon format. |
| `memberOf` | Direct group memberships. |
| `description` | May reveal role or operational context. |
| `pwdLastSet` | Shows password age. |
| `lastLogonTimestamp` | Shows approximate account activity. |
| `servicePrincipalName` | May indicate service account usage. |
| `userAccountControl` | Contains account behavior flags. |

User objects are security principals. They can authenticate, receive access tokens, belong to groups, and be assigned permissions.

A computer object represents a domain-joined machine.

Computer account names usually end with `$`.

Examples:

```text
WS01$
APP01$
DC01$
```

Computer objects are also security principals. They can authenticate to the domain and have permissions.

Important computer object fields:

| Field | Why it matters |
| --- | --- |
| `sAMAccountName` | Computer account name, usually ending in `$`. |
| `dNSHostName` | Hostname used in DNS. |
| `operatingSystem` | OS name. |
| `operatingSystemVersion` | OS version. |
| `servicePrincipalName` | Services registered to the computer. |
| `memberOf` | Groups the computer belongs to. |
| `userAccountControl` | Account behavior flags. |

A computer account has a password, but it is managed automatically by Windows.

In AD environments, computers are not passive inventory entries. They are identities with their own authentication material and permissions.

A group object collects users, computers, or other groups.

Groups are central to AD access control because permissions are usually assigned to groups, not individual users.

Important group concepts:

| Concept | Meaning |
| --- | --- |
| Direct membership | Object is directly added to a group. |
| Nested membership | Object gets access through another group. |
| Security group | Group used for access control. |
| Distribution group | Group mainly used for email distribution. |
| Domain group | Group stored in AD. |
| Local group | Group stored on a specific machine. |

Example nested membership:

```text
alice
  -> Helpdesk
  -> IT Operations
  -> Server Admins
```

Even if Alice is not directly added to `Server Admins`, she may still inherit access through nested group membership.

AD groups can be security groups or distribution groups.

| Type | Meaning |
| --- | --- |
| Security group | Can be used for permissions and access control. |
| Distribution group | Used mainly for email distribution. |

Security groups are more important for access decisions because they can appear in ACLs and access tokens.

Distribution groups usually do not grant access directly, but they can still provide useful organizational context.

AD security groups also have scopes.

| Scope | Meaning |
| --- | --- |
| Domain Local | Often used to assign access to resources in a domain. |
| Global | Often used to group users or computers from the same domain. |
| Universal | Can contain objects from multiple domains in the forest. |

In single-domain labs, group scope may not matter much.

In multi-domain environments, group scope becomes more important because it affects where the group can be used and what it can contain.

### OUs, Containers, GPOs and Service Accounts

An Organizational Unit, or OU, is a container used to organize AD objects.

Example:

```text
OU=Workstations,OU=Warsaw,DC=corp,DC=local
```

OUs commonly organize objects by:

- department
- location
- system type
- server role
- user type
- administrative ownership

OUs matter because:

- GPOs can be linked to them
- permissions can be delegated on them
- child objects can inherit permissions
- they reveal how the environment is structured

OUs are not the same as groups.

| OU | Group |
| --- | --- |
| Organizes objects in the directory tree. | Represents membership. |
| One object is usually located in one OU. | One object can be member of many groups. |
| Used for policy targeting and delegation. | Used for access control and role modeling. |

Containers are built-in directory locations that can hold objects.

Examples:

```text
CN=Users,DC=corp,DC=local
CN=Computers,DC=corp,DC=local
CN=System,DC=corp,DC=local
CN=Configuration,DC=corp,DC=local
```

Containers look similar to OUs in Distinguished Names, but they use `CN=` instead of `OU=`.

Example container:

```text
CN=Users,DC=corp,DC=local
```

Example OU:

```text
OU=Users,DC=corp,DC=local
```

Default containers often contain built-in, legacy, or manually created objects.

A Group Policy Object, or GPO, is used to configure users and computers centrally.

GPOs can define settings such as:

- security options
- registry settings
- local group membership
- logon scripts
- startup scripts
- drive mappings
- scheduled tasks
- firewall settings
- software deployment
- user environment settings

GPOs can be linked to:

- sites
- domains
- OUs

GPOs matter because they connect AD structure with endpoint configuration.

Example relationship:

```text
GPO -> linked to OU -> applies to users/computers inside that OU
```

A GPO has two main parts:

| Part | Meaning |
| --- | --- |
| Group Policy Container | AD object storing metadata. |
| Group Policy Template | Files stored in SYSVOL. |

SYSVOL path example:

```text
\\corp.local\SYSVOL\corp.local\Policies\
```

A service account is an account used by an application, service, scheduled task, database, web server, backup system, monitoring tool, or integration.

A service account may be:

- a normal user account
- a managed service account
- a group managed service account
- a computer account
- an application-specific identity

Service accounts are important because they often have:

- long-lived passwords
- access to applications or databases
- SPNs
- permissions on servers
- access to file shares
- delegated rights
- operational privileges

A normal user account used as a service account often looks like any other AD user, but attributes such as `servicePrincipalName`, description, naming convention, or group membership may reveal its purpose.

## AD Authentication

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What are you allowed to access?
```

In AD environments, authentication is usually handled through:

- Kerberos
- NTLM

Authorization is based on:

- SIDs
- group membership
- access tokens
- ACLs
- user rights
- local group membership
- domain group membership

Authentication proves identity. Authorization decides access.

### Local Authentication vs Domain Authentication

Windows can authenticate identities locally or through a domain.

| Type | Meaning |
| --- | --- |
| Local authentication | Uses an account stored on the local machine. |
| Domain authentication | Uses an account stored in Active Directory. |

Example local account:

```text
WS01\localadmin
```

Example domain account:

```text
CORP\alice
alice@corp.local
```

Local accounts exist only on one machine.

Domain accounts can be used across domain-joined systems, depending on permissions and policy.

This distinction is important because access to one local machine does not automatically mean access to the whole domain.

### Interactive and Network Logons

Windows has different logon types.

Common examples:

| Logon type | Meaning |
| --- | --- |
| Interactive | User logs on directly at keyboard or console. |
| Remote Interactive | User logs on through RDP. |
| Network | User accesses a remote network resource such as SMB. |
| Batch | Scheduled task or batch job logon. |
| Service | Service starts under an account. |
| New Credentials | Used when credentials are supplied for remote access without changing the local logon session. |
| Unlock | Workstation unlock. |

The logon type affects what credentials, tokens, and sessions may exist on a system.

For example, an RDP logon and an SMB network logon do not leave the same kind of session artifacts.

### Access Tokens

After authentication, Windows creates an access token.

The access token represents the security context of the user or process.

It contains information such as:

- user SID
- group SIDs
- privileges
- logon session information
- integrity level
- restricted SIDs, if present

When a process tries to access a resource, Windows checks the token against the resource's permissions.

Example:

```text
Process token -> contains user and group SIDs
Resource ACL  -> contains allowed or denied SIDs
Access check  -> compares token with ACL
```

This is why group membership matters. If a user's token contains a group SID that has access to a resource, the user may receive that access.

### Sessions

A session represents an authenticated interaction with a system or service.

Examples:

- user logged in through RDP
- user accessing SMB share
- service running under a domain account
- scheduled task running under a domain account
- WinRM session
- database connection using domain credentials

Sessions matter because they connect identities to machines.

In AD attack-path thinking, a session can be a relationship:

```text
User -> has session on -> Computer
```

This relationship can be important when the user is privileged and the machine is reachable or controlled.

### Credentials in Windows

Credentials can appear in different forms.

Common credential-related concepts:

| Concept | Meaning |
| --- | --- |
| Password | Plaintext secret known by the user or service. |
| NT hash | Hash derived from the password and used in Windows authentication contexts. |
| Kerberos ticket | Time-limited authentication data issued by the KDC. |
| TGT | Ticket Granting Ticket used to request service tickets. |
| TGS | Service ticket used to access a specific service. |
| Token | Local Windows security context after logon. |
| Certificate | Can be used for certificate-based authentication in some AD environments. |

Not all authentication material is the same.

A password, hash, ticket, token, and certificate have different formats and different usage contexts.

## Kerberos Basics

Kerberos is the main authentication protocol in modern AD environments.

It is ticket-based.

Instead of sending a password to every service, the user proves identity to the domain controller and receives tickets that can be used to access services.

Kerberos uses three main parties:

| Component | Meaning |
| --- | --- |
| Client | User or computer requesting access. |
| KDC | Key Distribution Center running on the domain controller. |
| Service | Target service the client wants to access. |

The KDC has two logical services:

| Service | Meaning |
| --- | --- |
| Authentication Service | Issues Ticket Granting Tickets. |
| Ticket Granting Service | Issues service tickets. |

### Kerberos Terms

| Term | Meaning |
| --- | --- |
| Realm | Kerberos administrative domain, usually uppercase AD DNS name. |
| Principal | Kerberos identity, such as user or service. |
| KDC | Service that issues Kerberos tickets. |
| TGT | Ticket Granting Ticket. |
| TGS | Ticket Granting Service ticket, also called service ticket. |
| SPN | Service Principal Name identifying a service. |
| PAC | Privilege Attribute Certificate containing authorization data. |
| Session key | Temporary key used in Kerberos exchanges. |
| krbtgt | Special account used to sign and encrypt TGTs. |

Example realm:

```text
CORP.LOCAL
```

Example user principal:

```text
alice@CORP.LOCAL
```

Example SPNs:

```text
HTTP/web01.corp.local
MSSQLSvc/sql01.corp.local:1433
CIFS/filesrv01.corp.local
HOST/app01.corp.local
```

### Kerberos Flow

A simplified Kerberos flow looks like this:

```text
1. User authenticates to the KDC.
2. KDC issues a TGT.
3. User asks the KDC for a service ticket.
4. KDC issues a TGS for the requested SPN.
5. User presents the TGS to the target service.
6. Service validates the ticket and grants access if authorized.
```

More detailed view:

```text
Client -> AS-REQ -> KDC
Client <- AS-REP <- KDC

Client -> TGS-REQ -> KDC
Client <- TGS-REP <- KDC

Client -> AP-REQ -> Service
Client <- AP-REP <- Service, optional
```

The important idea is that the password is not sent directly to the target service. Tickets are used instead.

### Ticket Granting Ticket

A Ticket Granting Ticket, or TGT, proves that the user authenticated to the KDC.

A TGT is used to request service tickets.

Conceptually:

```text
User password -> proves identity to KDC -> receives TGT
TGT -> requests TGS for services
```

The TGT is encrypted and signed using material associated with the `krbtgt` account.

The `krbtgt` account is extremely important in AD because it is tied to the trust model for Kerberos tickets inside the domain.

### Service Ticket

A service ticket, also called a TGS, is used to access a specific service.

Example:

```text
User wants access to CIFS/filesrv01.corp.local
KDC issues a service ticket for CIFS/filesrv01.corp.local
User presents the ticket to filesrv01
```

Service tickets are tied to SPNs.

This is why SPNs are important in AD. They connect Kerberos authentication to specific services.

### Service Principal Name

A Service Principal Name, or SPN, identifies a service instance.

General SPN format:

```text
serviceclass/host:port
```

Examples:

```text
HTTP/web01.corp.local
MSSQLSvc/sql01.corp.local:1433
CIFS/filesrv01.corp.local
LDAP/dc01.corp.local
HOST/app01.corp.local
```

SPNs are stored on AD accounts.

A service running under a domain user account may have SPNs registered on that user account. A service running as LocalSystem on a domain-joined machine usually uses the computer account.

SPNs matter because Kerberos needs to know which account owns the service.

### Kerberos Time

Kerberos is time-sensitive.

Clients, services, and domain controllers need reasonably synchronized clocks.

If time skew is too large, Kerberos authentication may fail.

Typical symptoms of time problems include:

- Kerberos errors
- failed ticket requests
- authentication failure despite valid credentials
- fallback to NTLM in some situations
- inconsistent behavior between systems

Time synchronization is usually handled through Windows domain time hierarchy.

### Kerberos Encryption Types

Kerberos tickets and keys can use different encryption types.

Common examples:

| Type | Meaning |
| --- | --- |
| RC4-HMAC | Older type related to NT hash material. |
| AES128 | AES with 128-bit key. |
| AES256 | AES with 256-bit key. |

Older environments may still support RC4.

Newer environments should commonly support AES, but the actual behavior depends on account settings, domain configuration, and compatibility requirements.

For pentest understanding, encryption type matters because the ticket material and cracking difficulty can differ depending on the type.

## NTLM Basics

NTLM is an older Windows authentication protocol.

It is still commonly present because many environments need backward compatibility, legacy systems, local authentication, IP-based access, or applications that do not use Kerberos correctly.

NTLM is challenge-response based.

The password itself is not sent over the network. Instead, the client proves knowledge of password-derived material by responding to a server challenge.

Simplified flow:

```text
1. Client sends username and domain information.
2. Server sends a random challenge.
3. Client calculates a response using password-derived material.
4. Server validates the response directly or through a domain controller.
```

### NT Hash

The NT hash is derived from the user's password.

It is often called the NTLM hash, although technically the NT hash is the password-derived hash and NTLM is the authentication protocol.

Example format:

```text
aad3b435b51404eeaad3b435b51404ee:8846f7eaee8fb117ad06bdd830b7586c
```

The first part is the LM hash position and is often disabled or empty-equivalent.

The second part is the NT hash.

In many tools, hashes are represented as:

```text
LMHASH:NTHASH
```

If LM is not used, the LM portion may appear as:

```text
aad3b435b51404eeaad3b435b51404ee
```

### NetNTLM

NetNTLM is not the same thing as an NT hash.

NetNTLM refers to challenge-response material captured during NTLM authentication.

Simple distinction:

| Material | Meaning |
| --- | --- |
| NT hash | Password-derived hash stored or used locally by Windows. |
| NetNTLMv1/v2 | Network challenge-response authentication material. |

NetNTLM material is usually not directly used as a password equivalent in the same way as an NT hash.

This distinction matters because many beginners confuse NT hashes, NTLM, and NetNTLM.

### NTLM Authentication Paths

NTLM can be used in different situations.

Common examples:

| Situation | Why NTLM may appear |
| --- | --- |
| Access by IP address | Kerberos usually needs SPN-based hostname access. |
| Legacy application | Application does not support Kerberos correctly. |
| Workgroup or local auth | No domain Kerberos available. |
| Missing or broken SPN | Kerberos cannot identify the service. |
| Cross-boundary scenario | Kerberos path may not be available. |
| Fallback behavior | Client or service falls back from Kerberos to NTLM. |

In domain environments, NTLM authentication may still involve a domain controller for validation.

### Kerberos vs NTLM

| Feature | Kerberos | NTLM |
| --- | --- | --- |
| Type | Ticket-based | Challenge-response |
| Main AD use | Default modern domain authentication | Legacy and fallback authentication |
| Requires SPN | Yes, for service authentication | No |
| Uses KDC | Yes | No KDC, but DC may validate |
| Time-sensitive | Yes | Less dependent on strict time sync |
| Supports delegation | Yes | Not in the same Kerberos model |
| Common identity format | `user@REALM` | `DOMAIN\user` |
| Typical failure fallback | May fall back to NTLM | Already NTLM |

Kerberos is usually preferred in AD environments, but NTLM remains important because it is still widely seen in real networks and labs.

## LDAP Basics

LDAP stands for Lightweight Directory Access Protocol.

In Active Directory, LDAP is used to query and interact with directory data.

LDAP can be used to read information about:

- users
- groups
- computers
- OUs
- GPO metadata
- trusts
- service accounts
- SPNs
- domain configuration
- certificate services objects
- ACL-related attributes

LDAP is one of the most important protocols for understanding AD structure.

### LDAP Ports

Common LDAP-related ports:

| Port | Service |
| --- | --- |
| `389` | LDAP |
| `636` | LDAPS |
| `3268` | Global Catalog LDAP |
| `3269` | Global Catalog LDAPS |

LDAP on port `389` is normal LDAP.

LDAPS on port `636` is LDAP over TLS.

Global Catalog ports are used for forest-wide searches.

### LDAP Bind

An LDAP bind is an authentication step to the LDAP service.

Common bind concepts:

| Bind type | Meaning |
| --- | --- |
| Anonymous bind | Connects without credentials, if allowed. |
| Simple bind | Username and password style bind. |
| SASL bind | Uses mechanisms such as Kerberos or NTLM. |
| LDAPS bind | LDAP bind protected with TLS. |

Many AD environments do not allow useful anonymous LDAP access, but authenticated users can usually read a large amount of directory information.

### LDAP Search Base

The search base defines where the LDAP search starts.

Example base DN:

```text
DC=corp,DC=local
```

This searches from the domain root.

Example OU base:

```text
OU=Users,DC=corp,DC=local
```

This searches only under the `Users` OU.

The base DN controls the part of the directory tree being queried.

### LDAP Search Scope

LDAP searches have different scopes.

| Scope | Meaning |
| --- | --- |
| Base | Only the exact object specified by the base DN. |
| OneLevel | Objects directly under the base DN. |
| Subtree | The base DN and all child objects below it. |

Most domain enumeration uses subtree searches because the goal is to find objects anywhere under the domain root.

### LDAP Filters

LDAP filters define which objects should be returned.

Example filter for users:

```text
(objectClass=user)
```

Example filter for computers:

```text
(objectClass=computer)
```

Example filter for groups:

```text
(objectClass=group)
```

AND filter:

```text
(&(objectClass=user)(sAMAccountName=alice))
```

OR filter:

```text
(|(sAMAccountName=alice)(sAMAccountName=bob))
```

NOT filter:

```text
(!(objectClass=computer))
```

LDAP filters are important because most AD tools are essentially performing LDAP queries with useful filters and formatting the output.

### Common LDAP Attributes

| Attribute | Meaning |
| --- | --- |
| `distinguishedName` | Full LDAP path of the object. |
| `sAMAccountName` | Legacy account name. |
| `userPrincipalName` | UPN logon name. |
| `objectSid` | Security Identifier. |
| `objectGUID` | Globally unique object identifier. |
| `objectClass` | Object class hierarchy. |
| `objectCategory` | Main object category. |
| `memberOf` | Groups an object belongs to. |
| `member` | Members of a group. |
| `servicePrincipalName` | Kerberos service identifiers. |
| `description` | Free-text description. |
| `userAccountControl` | Account behavior bitmask. |
| `pwdLastSet` | Password last set time. |
| `lastLogonTimestamp` | Approximate replicated last logon. |

Understanding LDAP attributes makes tool output much easier to interpret.

### objectClass vs objectCategory

`objectClass` and `objectCategory` are both used to describe objects, but they are not identical.

| Field | Meaning |
| --- | --- |
| `objectClass` | Class hierarchy of the object. |
| `objectCategory` | Main category of the object. |

Example user object may include multiple object classes:

```text
top
person
organizationalPerson
user
```

The object category may point to:

```text
CN=Person,CN=Schema,CN=Configuration,DC=corp,DC=local
```

In many cases, filters combine both fields to avoid noisy results.

Example:

```text
(&(objectCategory=person)(objectClass=user))
```

## DNS in AD

DNS is critical in Active Directory.

AD clients use DNS to find domain controllers and domain services.

Without working DNS, domain authentication and service discovery usually break.

AD relies heavily on SRV records.

SRV records tell clients where important services are located.

Common AD DNS uses:

- finding domain controllers
- finding Kerberos services
- finding LDAP services
- finding Global Catalog servers
- locating site-specific domain controllers
- resolving hostnames of domain systems

### AD DNS Zones

AD-integrated DNS zones are stored in Active Directory and replicated between DNS servers, usually domain controllers.

Common zone examples:

```text
corp.local
_msdcs.corp.local
```

The main domain zone contains normal host records.

The `_msdcs` zone contains records related to domain controller and service discovery.

Important DNS record types:

| Record type | Meaning |
| --- | --- |
| `A` | Maps hostname to IPv4 address. |
| `AAAA` | Maps hostname to IPv6 address. |
| `CNAME` | Alias record. |
| `SRV` | Service discovery record. |
| `PTR` | Reverse DNS lookup record. |
| `NS` | Name server record. |
| `SOA` | Start of authority record. |

### SRV Records

SRV records are one of the most important DNS record types in AD.

They identify which hosts provide specific services.

Common AD SRV record patterns:

```text
_ldap._tcp.dc._msdcs.corp.local
_kerberos._tcp.corp.local
_kerberos._udp.corp.local
_gc._tcp.corp.local
_ldap._tcp.gc._msdcs.corp.local
```

Examples of what these records help find:

| SRV record | Purpose |
| --- | --- |
| `_ldap._tcp.dc._msdcs.domain` | Domain controllers for LDAP. |
| `_kerberos._tcp.domain` | Kerberos services over TCP. |
| `_kerberos._udp.domain` | Kerberos services over UDP. |
| `_gc._tcp.domain` | Global Catalog servers. |
| `_ldap._tcp.SiteName._sites.domain` | Site-specific LDAP service. |

When a Windows client joins or uses a domain, DNS service discovery is part of how it finds the right domain services.

### DNS and Domain Controllers

Domain controllers register DNS records so that clients can locate them.

A domain controller may register:

- host records
- LDAP SRV records
- Kerberos SRV records
- Global Catalog SRV records, if it is a GC
- site-specific service records
- domain GUID records

Example DC hostname:

```text
dc01.corp.local
```

Example records:

```text
dc01.corp.local
_ldap._tcp.dc._msdcs.corp.local
_kerberos._tcp.corp.local
```

DNS problems can cause AD symptoms that look like authentication or connectivity problems.

### Reverse DNS

Reverse DNS maps IP addresses back to names.

Example:

```text
10.10.10.5 -> dc01.corp.local
```

Reverse DNS is not always configured, but when it works, it can help identify hosts and naming patterns.

In labs, reverse DNS may reveal useful hostnames even before full domain context is known.
