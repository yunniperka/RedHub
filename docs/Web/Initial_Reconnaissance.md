# Initial Reconnaissance for Web Application Penetration Testing

## Purpose

Initial reconnaissance is the first web-focused phase of a penetration test. The goal is not to exploit the target yet. The goal is to build a useful map of the web attack surface so the next testing phases are focused and efficient.

These notes intentionally focus on web application reconnaissance only:

* subdomains
* live web applications
* directories and files
* URLs and endpoints
* parameters
* JavaScript-discovered endpoints
* APIs
* authentication and roles
* technology fingerprinting
* public information leakage
* inputs that suggest next vulnerability tests

Network service scanning, broad port scanning, and generic Nmap methodology are intentionally excluded.

---

## Main Outputs

At the end of initial recon, you should have:

| Output | Why it matters |
| --- | --- |
| In-scope domains and subdomains | Defines what can be tested. |
| Live HTTP/HTTPS services | Shows which assets are reachable as web apps. |
| Application inventory | Groups targets by app, environment, owner, and technology. |
| URL and endpoint list | Drives crawling, fuzzing, and manual testing. |
| Parameter list | Drives injection, access control, IDOR, and logic testing. |
| Directory and file discovery results | Finds hidden panels, old files, backups, APIs, and debug endpoints. |
| JavaScript endpoint list | Finds API routes, feature flags, source maps, and hidden client-side routes. |
| Authentication and role map | Drives access control and privilege testing. |
| Technology stack | Drives framework-specific and version-specific checks. |
| Interesting findings list | Prioritized next steps for the actual pentest. |

---

## Passive Reconnaissance

Passive recon uses public information and normally does not send traffic directly to the target application.

### Search Engine Discovery

Use search engines to find indexed content and leaks.

Useful queries:

```text
site:example.com
site:example.com filetype:pdf
site:example.com filetype:xls OR filetype:xlsx
site:example.com filetype:doc OR filetype:docx
site:example.com inurl:admin
site:example.com inurl:login
site:example.com inurl:api
site:example.com inurl:swagger
site:example.com inurl:backup
site:example.com ext:sql OR ext:bak OR ext:zip
site:example.com "password"
site:example.com "api_key"
site:example.com "BEGIN PRIVATE KEY"

```

Look for:

* old endpoints
* admin portals
* indexed documents
* email addresses and usernames
* staging/dev/test environments
* exposed backups
* API documentation
* error pages
* public support or issue tracker links

### Public Code Search

Search public repositories for:

| Item | Examples |
| --- | --- |
| Domains and subdomains | `example.com`, `api.example.com` |
| API routes | `/api/v1/users`, `/graphql`, `/internal` |
| Secrets | API keys, tokens, private keys, `.env` values |
| Cloud assets | S3 buckets, Azure Blob names, GCS buckets |
| Technology hints | package files, Dockerfiles, CI/CD files |
| Internal names | project names, environment names, tenant names |

Useful search targets:

* GitHub
* GitLab
* Bitbucket
* public package registries
* Docker Hub
* npm
* PyPI
* public CI logs

Example GitHub searches:

```text
"example.com"
"api.example.com"
"example.com" "password"
"example.com" "Authorization"
"example.com" "Bearer"
"example.com" "aws_access_key_id"
"example.com" "s3.amazonaws.com"

```

### Certificate Transparency

Certificate Transparency logs often reveal subdomains that were never linked from the main site.

Common sources:

* crt.sh
* Censys
* CertSpotter
* SecurityTrails
* Shodan certificate data

Look for:

* `dev.example.com`
* `staging.example.com`
* `test.example.com`
* `admin.example.com`
* `vpn.example.com`
* `api.example.com`
* `old.example.com`
* wildcard certificates

### Archived URLs

Archived URLs are valuable because they may reveal old endpoints, retired API routes, parameters, and hidden files.

Useful sources:

* Wayback Machine
* Common Crawl
* URLScan
* AlienVault OTX

Example with `gau`:

```bash
gau example.com | tee urls/archived.txt

```

Useful filtering:

```bash
cat urls/archived.txt | sort -u > urls/archived_unique.txt

cat urls/archived_unique.txt | grep -Ei '\.js($|\?)' > js/js_files_archived.txt

cat urls/archived_unique.txt | grep -Ei '(\?|=)' > params/urls_with_params.txt

cat urls/archived_unique.txt | grep -Ei '(admin|login|debug|backup|api|graphql|swagger|internal)' > urls/interesting_urls.txt

```

---

## Subdomain Enumeration

Subdomain enumeration expands the target list beyond the main website.

### Passive Subdomain Enumeration

Passive enumeration uses public data sources.

Example tools:

```bash
subfinder -d example.com -all -silent -o subdomains/subfinder.txt

amass enum -passive -d example.com -o subdomains/amass_passive.txt

```

Merge and deduplicate:

```bash
cat subdomains/*.txt | sed 's/^\*\.//' | sort -u > subdomains/all.txt

```

### Active Subdomain Discovery

Active discovery guesses names and resolves them.

Common word themes:

```text
admin
api
app
auth
backup
beta
cdn
cms
crm
dashboard
dev
files
internal
login
mail
mobile
old
portal
preprod
prod
sso
stage
staging
static
test
uat
vpn
www

```

Example with DNS resolver tooling:

```bash
dnsx -l subdomains/all.txt -silent -resp -o subdomains/resolved.txt

```

### Permutation and Alteration

If you find:

```text
api.example.com
dev-api.example.com
portal-staging.example.com

```

generate variations such as:

```text
api-dev.example.com
api-staging.example.com
api-test.example.com
portal-dev.example.com
portal-uat.example.com

```

Good candidates for deeper review:

| Pattern | Why interesting |
| --- | --- |
| `dev`, `test`, `stage`, `uat` | Often weaker controls or debug features. |
| `admin`, `portal`, `dashboard` | Authentication and authorization targets. |
| `api`, `graphql`, `mobile` | Direct backend functionality. |
| `old`, `legacy`, `backup` | Unmaintained code and forgotten files. |
| `internal`, `intranet` | Possible access control mistakes. |

### Wildcard DNS Handling

Some domains resolve every subdomain to the same IP. This creates false positives.

Check with random names:

```bash
dnsx -silent -a -resp-only -l <(printf "doesnotexist-73921.example.com\nrandom-88421.example.com\n")

```

If random names resolve, you need to filter wildcard responses.

---

## Validate Live Web Hosts

After subdomain enumeration, identify which hosts serve HTTP or HTTPS.

Example with `httpx`:

```bash
httpx -l subdomains/all.txt \
  -silent \
  -follow-host-redirects \
  -status-code \
  -title \
  -tech-detect \
  -web-server \
  -content-length \
  -location \
  -json \
  -o http/httpx.jsonl

```

Create a simple live host list:

```bash
cat http/httpx.jsonl | jq -r '.url' | sort -u > http/live.txt

```

Useful fields to collect:

| Field | Why it matters |
| --- | --- |
| URL | Defines the live app entry point. |
| Status code | Helps identify login pages, redirects, errors, forbidden areas. |
| Title | Quick app identification. |
| Server header | Helps fingerprint technology. |
| Technologies | Suggests next framework-specific tests. |
| Content length | Helps detect duplicate/default responses. |
| Redirect location | Reveals canonical hosts, SSO, tenants, or hidden paths. |
| CDN/WAF info | Affects testing strategy and rate limits. |
| Screenshot | Helps triage many hosts quickly. |

---

## Screenshot and Triage

Screenshots help quickly group web apps.

Look for:

* login panels
* admin dashboards
* default pages
* error pages
* documentation pages
* exposed development tools
* staging banners
* maintenance pages
* different apps behind similar domains

Possible triage categories:

| Category | Examples |
| --- | --- |
| Main production app | `www`, `app`, customer portal |
| API/documentation | `api`, Swagger, Redoc, GraphQL |
| Admin or back office | `admin`, `dashboard`, `cms` |
| Dev/test/staging | `dev`, `test`, `uat`, `staging` |
| Default service page | nginx, Apache, IIS, Tomcat, Laravel, Spring |
| Error-only host | 403, 404, 500, cloud provider error |
| Potential takeover | Unclaimed SaaS/cloud service response |

---

## Web Application Fingerprinting

Fingerprinting identifies the stack so you can choose relevant tests.

### What to Fingerprint

| Signal | Examples |
| --- | --- |
| Headers | `Server`, `X-Powered-By`, `Set-Cookie`, `Via`, `X-Generator` |
| Cookies | `PHPSESSID`, `JSESSIONID`, `.AspNetCore`, `laravel_session` |
| HTML | meta generator tags, comments, script paths |
| JavaScript | framework bundles, source maps, build paths |
| Error pages | stack traces, framework names, versions |
| Favicon hash | Can identify common products or panels. |
| Static paths | `/wp-content/`, `/static/`, `/_next/`, `/assets/` |
| Login page text | Product names, SSO provider, tenant names |
| TLS certificate | SANs, issuer, environment names |
| Redirects | SSO, reverse proxies, canonical domains |

### Technology to Next Test Mapping

| Technology signal | Next tests to plan |
| --- | --- |
| WordPress | Plugins, themes, users, XML-RPC, backups, uploads. |
| Drupal/Joomla | CMS version, modules, admin paths, exposed config. |
| Laravel | `.env`, debug mode, logs, route leaks, storage links. |
| Django | debug mode, admin panel, CSRF/session behavior. |
| Rails | routes, exposed credentials, debug pages, signed cookies. |
| Spring Boot | Actuator endpoints, error pages, API docs. |
| ASP.NET | ViewState, IIS files, debug traces, auth flows. |
| Next.js/Nuxt/Vite | JavaScript routes, source maps, SSR/API endpoints. |
| GraphQL | Schema discovery, introspection, authz, batching, depth. |
| Swagger/OpenAPI | API enumeration, auth requirements, hidden endpoints. |
| SSO/SAML/OIDC | Redirect handling, callback URLs, role mapping. |
| WebSocket | Message schema, auth, cross-site WebSocket risks. |

---

## Manual Application Mapping

Manual mapping is essential. Automated crawlers miss business logic, authenticated flows, and multi-step workflows.

Use a browser through Burp Suite, OWASP ZAP, Caido, or another intercepting proxy.

Map:

| Area | What to capture |
| --- | --- |
| Landing pages | Main navigation, public pages, hidden links. |
| Registration | Required fields, email verification, invitation flows. |
| Login | SSO, MFA, remember-me, lockout, password reset. |
| User profile | Editable fields, file upload, IDs, preferences. |
| Search/filtering | Parameters, sorting, pagination, query syntax. |
| Object pages | User IDs, order IDs, invoice IDs, project IDs. |
| Admin functions | User management, role changes, exports, imports. |
| File handling | Upload, download, preview, delete, conversion. |
| Payment/checkout | Cart, coupons, price fields, callbacks. |
| Notifications | Emails, webhooks, templates, message previews. |
| API calls | REST, GraphQL, WebSockets, background XHR/fetch. |

Record:

* endpoint
* method
* parameters
* authentication required
* role required
* content type
* interesting IDs
* response type
* next tests

---

## Crawling

Crawling discovers linked pages, forms, JavaScript routes, and XHR/fetch endpoints.

### Standard Crawl

Fast but may miss JavaScript-rendered routes.

```bash
katana -list http/live.txt \
  -silent \
  -d 3 \
  -jc \
  -kf all \
  -o urls/katana.txt

```

### Headless Crawl

Slower, but better for SPAs and JavaScript-heavy apps.

```bash
katana -list http/live.txt \
  -headless \
  -jc \
  -js-crawl \
  -xhr \
  -d 3 \
  -o urls/katana_headless.txt

```

Merge results:

```bash
cat urls/katana*.txt urls/archived*.txt 2>/dev/null | sort -u > urls/all_urls.txt

```

Crawl findings that usually matter:

| Finding | Why it matters |
| --- | --- |
| Forms | Input handling, CSRF, validation. |
| Query parameters | Injection and access control testing. |
| API calls | Backend attack surface. |
| Hidden routes | Client-side routes not linked from menus. |
| JavaScript files | Endpoint and secret discovery. |
| File upload paths | Upload testing. |
| WebSocket URLs | WebSocket security testing. |

---

## Directory and File Discovery

Directory and file discovery finds unlinked content.

### What to Look For

| Target | Examples |
| --- | --- |
| Admin paths | `/admin`, `/administrator`, `/manage`, `/dashboard` |
| API paths | `/api`, `/api/v1`, `/graphql`, `/rest`, `/backend` |
| Documentation | `/swagger`, `/api-docs`, `/redoc`, `/openapi.json` |
| Debug paths | `/debug`, `/trace`, `/actuator`, `/phpinfo.php` |
| Backup files | `.bak`, `.old`, `.zip`, `.tar.gz`, `.sql` |
| Config files | `.env`, `config.php`, `settings.py`, `web.config` |
| Source control | `/.git/`, `/.svn/` |
| Logs | `/logs`, `/error.log`, `/access.log` |
| Uploads | `/uploads`, `/files`, `/media`, `/storage` |
| Temporary files | `/tmp`, `/temp`, `/backup`, `/old` |

### ffuf Directory Discovery

Basic:

```bash
ffuf -w wordlists/common.txt \
  -u https://example.com/FUZZ \
  -ac \
  -o fuzzing/ffuf_dirs.json \
  -of json

```

With extensions:

```bash
ffuf -w wordlists/common.txt \
  -u https://example.com/FUZZ \
  -e .php,.aspx,.jsp,.html,.txt,.bak,.old,.zip,.sql \
  -ac \
  -o fuzzing/ffuf_files.json \
  -of json

```

With rate control:

```bash
ffuf -w wordlists/common.txt \
  -u https://example.com/FUZZ \
  -ac \
  -rate 20 \
  -t 10

```

### feroxbuster Example

```bash
feroxbuster -u https://example.com \
  -w wordlists/common.txt \
  -x php,aspx,jsp,html,txt,bak,old,zip,sql \
  -k \
  -o fuzzing/feroxbuster.txt

```

### Response Codes During Discovery

| Code | Meaning |
| --- | --- |
| 200 | Content exists. Review it. |
| 204 | Exists but empty. Still interesting. |
| 301/302/307/308 | Redirect. Follow and inspect destination. |
| 401 | Authentication required. Test after login. |
| 403 | Forbidden. May still exist and be worth deeper review. |
| 405 | Method not allowed. Try allowed methods later. |
| 500 | Server error. Could indicate hidden functionality or fragile input handling. |
| Soft 404 | Looks like 200 but is actually a fake not-found page. Calibrate filters. |

### Avoid Common Fuzzing Mistakes

* Do not trust status code alone.
* Filter by response size, words, and lines.
* Compare against random paths.
* Use recursion carefully.
* Keep rates reasonable.
* Use smaller wordlists first.
* Re-run discovery after authentication.
* Re-run discovery from important subdirectories, not only `/`.

---

## Virtual Host Discovery

Virtual host discovery finds hidden apps served by the same IP or reverse proxy.

Use when:

* a server responds differently based on `Host`
* DNS does not show all apps
* you found a shared IP
* you suspect internal/staging vhosts

Example:

```bash
ffuf -w wordlists/subdomains.txt \
  -u https://target-ip-or-host/ \
  -H "Host: FUZZ.example.com" \
  -ac \
  -o fuzzing/vhosts.json \
  -of json

```

Interesting signals:

* different title
* different content length
* different redirect
* different status code
* login panel appears
* environment banner appears

---

## Parameter Discovery

Parameters drive most web application testing.

### Sources of Parameters

| Source | Examples |
| --- | --- |
| Crawled URLs | `/search?q=test`, `/item?id=123` |
| Archived URLs | Old API routes and retired parameters. |
| HTML forms | Input names, hidden fields, CSRF tokens. |
| JavaScript | Fetch/XHR calls, route builders, GraphQL variables. |
| API docs | OpenAPI, Swagger, Postman collections. |
| Mobile endpoints | `/mobile/api`, app-specific routes. |
| Cookies | tracking IDs, feature flags, tenant IDs. |
| Headers | custom `X-*` headers, API version headers. |
| WebSockets | JSON message keys. |

### Interesting Parameter Names

| Parameter | Possible next test |
| --- | --- |
| `id`, `user_id`, `account_id`, `order_id` | IDOR, access control, SQLi. |
| `file`, `path`, `folder`, `template` | Path traversal, LFI, file disclosure. |
| `url`, `uri`, `redirect`, `next`, `return` | Open redirect, SSRF. |
| `search`, `q`, `query`, `keyword` | SQLi, XSS, search injection. |
| `sort`, `order`, `filter` | SQLi, logic bugs, mass assignment. |
| `callback`, `jsonp` | JSONP issues, XSS. |
| `debug`, `test`, `preview` | Debug exposure, auth bypass. |
| `role`, `admin`, `is_admin` | Privilege escalation, mass assignment. |
| `price`, `amount`, `discount`, `coupon` | Business logic testing. |
| `email`, `username`, `phone` | Account enumeration, injection. |
| `token`, `code`, `otp` | Token handling, brute force resistance. |
| `lang`, `locale`, `theme` | File inclusion, template issues. |

### Extract Parameters from URLs

```bash
cat urls/all_urls.txt \
  | grep '?' \
  | sed 's/.*?//' \
  | tr '&' '\n' \
  | cut -d '=' -f 1 \
  | sort -u > params/parameters.txt

```

### Parameter Fuzzing with ffuf

```bash
ffuf -w wordlists/parameters.txt \
  -u "https://example.com/search?FUZZ=test" \
  -ac \
  -o params/ffuf_params.json \
  -of json

```

### Parameter Discovery with Arjun

```bash
arjun -u https://example.com/search \
  -m GET \
  -oT params/arjun_get.txt

arjun -u https://example.com/api/search \
  -m POST \
  -oT params/arjun_post.txt

```

### Routing & Infrastructure Parameter Discovery

When mapping parameters, prioritize headers and parameters targeting underlying routing topology, reverse proxies, and caching layers. Misconfigurations here map to **HTTP Request Smuggling, Web Cache Poisoning, and Access Control Bypasses**.

| Header / Parameter | Target Behavior / Next Test |
| --- | --- |
| `X-Forwarded-Host` / `X-Forwarded-For` | Test for regional/IP restriction bypasses and Web Cache Poisoning. |
| `X-Original-URL` / `X-Rewrite-URL` | Exploits routing discrepancies to bypass local proxy rule restrictions (e.g., matching `/admin` access rules using `/public?X-Original-URL=/admin`). |
| `?cb=12345` (Cache Buster) | Append unique cache-busting strings to force edge environments to fetch clean responses during fuzzing. |

---

## JavaScript Reconnaissance

Modern web apps often expose useful information in JavaScript files.

### Collect JavaScript Files

From crawled and archived URLs:

```bash
cat urls/all_urls.txt \
  | grep -Ei '\.js($|\?)' \
  | sort -u > js/js_files.txt

```

Download for review:

```bash
mkdir -p js/files
cat js/js_files.txt | while read url; do
  name=$(echo "$url" | sed 's#[/:?&=]#_#g')
  curl -sk "$url" -o "js/files/$name"
done

```

### What to Search For

| Item | Why it matters |
| --- | --- |
| API endpoints | Hidden backend routes. |
| Full URLs | Other subdomains or third-party services. |
| Source maps | May reveal readable source code. |
| Secrets | API keys, tokens, credentials, private endpoints. |
| Feature flags | Hidden features or roles. |
| Route names | Client-side-only paths. |
| GraphQL queries | Schema hints and operation names. |
| WebSocket URLs | Real-time API attack surface. |
| Cloud bucket names | Storage exposure testing. |
| Comments/TODOs | Developer notes and unfinished features. |
| Environment names | dev, staging, internal APIs. |

#### Client-Side Secrets & Obfuscated Routes Code Auditing

Modern web single-page applications (SPAs) build components into highly minified chunks. Supplement typical manual lookups with specialized static extractors to filter structural endpoints out of client code cleanly.

```bash
# Scan downloaded client assets via automated file-system secret scanners
trufflehog filesystem js/files/

# Extract structural endpoints and implicit SPA routing trees via tailored regex strings
cat js/files/* | grep -oE "(['\"])/[a-zA-Z0-9_\-\/]+(['\"])" | sort -u > js/extracted_routes.txt

```

### Source Maps

Look for:

```text
app.js.map
main.js.map
bundle.js.map
/_next/static/chunks/*.js.map

```

Source maps can expose:

* original source code
* route structure
* comments
* internal package names
* API endpoints
* sometimes secrets

> **Tactical Tip:** If a `.js.map` exposure is identified, do not simply parse it through text viewers. Leverage dedicated source map reconstructors like `unwebpack-sourcemap` to unpack original functional templates into their native code tree locally, giving you parity with looking at a developer's private repository.

Do not treat a secret as valid until verified safely and within scope.

---

## API Discovery

APIs usually provide the most valuable next-step testing targets.

### Common API Paths

```text
/api
/api/v1
/api/v2
/rest
/graphql
/gql
/rpc
/backend
/internal
/mobile
/admin/api
/swagger
/swagger-ui
/api-docs
/openapi.json
/openapi.yaml
/redoc
/docs
/postman.json

```

### API Recon Checklist

| Item | What to record |
| --- | --- |
| Base URL | `https://api.example.com`, `/api/v1` |
| Auth type | Cookie, Bearer token, API key, mTLS, SSO |
| Content type | JSON, XML, GraphQL, multipart, protobuf |
| Versioning | URL version, header version, query version |
| Object IDs | UUID, integer, hashid, slug |
| Rate limits | Headers and observed behavior |
| Error format | Stack traces, validation errors, internal codes |
| CORS | Origins, credentials, methods, headers |
| Documentation | Swagger, OpenAPI, Redoc, GraphQL schema |
| Hidden methods | GET/POST/PUT/PATCH/DELETE differences |
| Role behavior | Guest, user, admin, tenant admin |

### Swagger/OpenAPI

Look for:

```text
/swagger.json
/openapi.json
/v3/api-docs
/api-docs
/swagger-ui/index.html

```

If found, extract:

* endpoints
* parameters
* schemas
* auth requirements
* admin-only routes
* deprecated routes
* file upload operations

### GraphQL

Common endpoints:

```text
/graphql
/gql
/api/graphql
/v1/graphql

```

Initial recon questions:

| Question | Why it matters |
| --- | --- |
| Is GraphQL exposed? | Defines a dedicated test area. |
| Is introspection enabled? | May reveal schema and operations. |
| Is authentication required? | Determines public attack surface. |
| Are errors verbose? | May leak resolver names and stack traces. |
| Are IDs global or guessable? | Useful for authorization testing. |
| Are mutations exposed? | Higher-risk functionality. |

#### Introspection Blindspots & Bypasses

If an infrastructure returns an introspection validation error, it does not mark the conclusion of the API mapping. Modern GraphQL engines utilize "Field Suggestions" algorithms that reveal structural schemas when queried close to valid inputs.

```
                  ┌─────────────── GraphQL Endpoint ──────────────┐
                  │                                               │
                  ▼                                               ▼
     [Introspection Enabled]                          [Introspection Disabled]
                  │                                               │
                  ▼                                               ▼
   • Dump full schema using InQL.                 • Use Clairvoyance / Graphw00f.
   • Map mutations and queries.                   • Exploit "Field Suggestions" errors.
   • Target Authorization (BOLA).                 • Reconstruct schema via brute-force.

```

```bash
# Brute-force schema models via error suggestion enumeration algorithms
clairvoyance -o graphql_schema.json https://example.com/graphql

```

---

## Authentication and Role Mapping

Recon should create a map of how users enter and move through the app.

### Authentication Areas

| Area | What to collect |
| --- | --- |
| Login | Endpoint, method, parameters, cookies. |
| Registration | Required fields, email verification, invitation flows. |
| Password reset | Token format, delivery channel, expiration hints. |
| MFA | Methods, backup codes, remember device behavior. |
| SSO | OIDC/SAML endpoints, callback URLs, tenant selection. |
| Logout | Token invalidation, session cookie clearing. |
| Session cookies | Flags, names, scope, SameSite, domain. |
| CSRF tokens | Location, rotation behavior, per-form or per-session. |

### Role and Tenant Mapping

Create a simple matrix:

| Function | Guest | User | Manager | Admin | Notes |
| --- | --- | --- | --- | --- | --- |
| View profile | Yes | Yes | Yes | Yes | Record object IDs. |
| Edit profile | No | Own only | Team | Any | Good access control target. |
| Export data | No | No | Yes | Yes | Check file generation. |
| User management | No | No | No | Yes | High-value endpoint. |
| API docs | Maybe | Maybe | Maybe | Maybe | Verify each role. |

This prepares the next phase:

* IDOR testing
* horizontal privilege escalation
* vertical privilege escalation
* tenant isolation testing
* workflow bypass testing

---

## Webserver Metafiles and Public Policy Files

These files are not vulnerabilities by themselves, but they reveal routes, policies, and app structure.

| File | Why it matters |
| --- | --- |
| `/robots.txt` | Disallowed paths can reveal admin or private areas. |
| `/sitemap.xml` | Lists routes that may not be linked visibly. |
| `/.well-known/security.txt` | Security contact and sometimes asset hints. |
| `/.well-known/assetlinks.json` | Android app associations and package names. |
| `/.well-known/apple-app-site-association` | iOS app associations and routes. |
| `/crossdomain.xml` | Legacy Flash cross-domain policy. |
| `/clientaccesspolicy.xml` | Legacy Silverlight policy. |
| `/humans.txt` | Developer/team hints. |
| `/ads.txt` | Related domains and business context. |

Check quickly:

```bash
for path in robots.txt sitemap.xml .well-known/security.txt .well-known/assetlinks.json .well-known/apple-app-site-association crossdomain.xml clientaccesspolicy.xml; do
  curl -sk "https://example.com/$path" -I
done

```

---

## Information Leakage in Content

Review public content for:

| Leak | Examples |
| --- | --- |
| Usernames | emails, author names, support staff. |
| Internal hostnames | `internal-api`, `corp-db`, `staging`. |
| Software versions | framework, CMS, server versions. |
| Stack traces | file paths, package names, line numbers. |
| Comments | TODO, debug notes, disabled links. |
| Documents | metadata in PDFs, spreadsheets, Word files. |
| Backup names | old URLs, database names, project names. |
| Environment banners | staging, development, QA. |
| Tenant or org IDs | useful for authorization testing. |

Document metadata may reveal:

* usernames
* internal paths
* software versions
* template names
* email addresses

---

## Hidden and High-Value Paths

Prioritize these during discovery:

```text
/admin
/administrator
/backend
/manage
/dashboard
/cms
/login
/logout
/register
/signup
/password-reset
/reset
/api
/api/v1
/graphql
/swagger
/api-docs
/redoc
/openapi.json
/debug
/trace
/actuator
/phpinfo.php
/server-status
/uploads
/files
/media
/storage
/backup
/backups
/old
/dev
/test
/staging
/.git
/.env

```

High-value file extensions:

```text
.bak
.old
.orig
.save
.swp
.tmp
.zip
.tar
.tar.gz
.7z
.rar
.sql
.db
.sqlite
.log
.conf
.config
.yml
.yaml
.json
.env

```

---

## Cloud and External Asset Hints

Web apps often expose cloud resources indirectly.

Look for:

| Asset | Where it appears |
| --- | --- |
| S3 buckets | JavaScript, HTML, upload URLs, CNAMEs. |
| Azure Blob containers | JS files, image URLs, documents. |
| GCS buckets | Static assets, download links. |
| Firebase projects | JS config, mobile app files. |
| CDN origins | Headers, CNAMEs, error pages. |
| SaaS apps | CNAMEs, SSO links, login redirects. |
| Webhooks | JS, API docs, admin UI. |

Next steps depend on scope:

* check public listing/read access
* check upload permissions
* check CORS
* check signed URL behavior
* check tenant isolation
* check subdomain takeover risk

---

## CORS and Security Headers Recon

During recon, collect headers. Full exploitation comes later.

Important headers:

| Header | Why it matters |
| --- | --- |
| `Access-Control-Allow-Origin` | May indicate CORS issues. |
| `Access-Control-Allow-Credentials` | Higher risk if combined with permissive origin. |
| `Content-Security-Policy` | Helps plan XSS testing. |
| `Set-Cookie` | Check `HttpOnly`, `Secure`, `SameSite`, domain, path. |
| `Strict-Transport-Security` | TLS enforcement. |
| `X-Frame-Options` / `frame-ancestors` | Clickjacking exposure. |
| `X-Content-Type-Options` | MIME sniffing protection. |
| `Referrer-Policy` | Information leakage through referrers. |
| `Permissions-Policy` | Browser feature restrictions. |

Collect headers:

```bash
curl -skI https://example.com

```

or at scale with httpx:

```bash
httpx -l http/live.txt -silent -json -include-response-header -o http/headers.jsonl

```

---

## Recon Data Triage

Not every discovered item deserves the same time. Prioritize based on impact and testability.

| Finding | Priority | Why |
| --- | --- | --- |
| Unauthenticated admin panel | High | May expose weak auth or default credentials. |
| Staging app with real data | High | Often weaker controls. |
| API documentation | High | Gives complete endpoint and parameter map. |
| GraphQL endpoint | High | Dedicated testing surface. |
| File upload endpoint | High | Usually high-impact if vulnerable. |
| Object IDs in URLs | High | IDOR and access control testing. |
| Hidden backup/config file | High | Possible sensitive data exposure. |
| Verbose error page | Medium | Helps fingerprint and find injection points. |
| Old archived endpoint | Medium | May still exist or reveal parameters. |
| Static marketing page | Low | Usually limited attack surface. |
| CDN-only static host | Low | Still check for source maps and bucket hints. |

---

## Mapping Findings to Next Tests

Use this table to convert recon findings into the next pentest actions.

| Recon finding | Next tests |
| --- | --- |
| Search fields or filter parameters | SQLi, NoSQLi, XSS, template injection. |
| Reflected parameters | XSS, open redirect, HTML injection. |
| `id`, `user_id`, `order_id` | IDOR, authorization bypass, SQLi. |
| `file`, `path`, `template` | Path traversal, LFI, file disclosure. |
| `url`, `redirect`, `next`, `return` | Open redirect, SSRF. |
| File upload endpoint | Upload bypass, content-type checks, storage access. |
| API docs | Auth bypass, BOLA/IDOR, mass assignment, rate limits. |
| GraphQL endpoint | Introspection, authorization, batching, depth, complexity. |
| WebSocket endpoint | Auth, origin checks, message tampering. |
| Admin panel | Access control, default creds if allowed, session handling. |
| Password reset flow | Token entropy, expiration, account enumeration. |
| SSO/OIDC/SAML | Redirect URI, state/nonce, role mapping, callback handling. |
| Verbose errors | Injection, path leakage, framework-specific tests. |
| Source maps | Source review, hidden routes, secrets review. |
| CORS wildcard | CORS exploitation testing. |
| Missing security headers | XSS/clickjacking/session hardening review. |
| Cloud bucket names | Storage permission testing. |
| CNAME to SaaS error page | Subdomain takeover check. |

---

## Recommended Wordlists

Good wordlist categories:

| Category | Examples |
| --- | --- |
| Directories/files | common web paths, technology-specific paths. |
| API paths | `api`, `v1`, `graphql`, `swagger`, `openapi`. |
| Parameters | generic parameter names, framework-specific names. |
| Subdomains | common names and environment names. |
| Extensions | based on technology: `.php`, `.aspx`, `.jsp`, `.js`, `.json`. |
| Backup names | `.bak`, `.old`, `.zip`, `.tar.gz`, `.sql`. |

Common sources:

* SecLists
* Assetnote wordlists
* custom wordlists built from the target
* words extracted from page content and JavaScript
* words extracted from URLs and route names

Build a target-specific wordlist:

```bash
cat urls/all_urls.txt js/endpoints.txt \
  | tr '/?&=._-:' '\n' \
  | grep -E '^[a-zA-Z0-9]{3,}$' \
  | sort -u > fuzzing/target_words.txt

```

---

## Practical Command Pipeline

This is a simple web-focused recon pipeline. Adjust rate limits and scope before running.

### 1. Define Scope

```bash
mkdir -p recon/{scope,subdomains,http,urls,params,js,fuzzing,report}

cat > recon/scope/domains.txt << 'EOF'
example.com
EOF

```

### 2. Passive Subdomain Discovery

```bash
subfinder -dL recon/scope/domains.txt -all -silent -o recon/subdomains/subfinder.txt

while read domain; do
  amass enum -passive -d "$domain" -o "recon/subdomains/amass_$domain.txt"
done < recon/scope/domains.txt

cat recon/subdomains/*.txt | sed 's/^\*\.//' | sort -u > recon/subdomains/all.txt

```

### 3. Resolve Subdomains

```bash
dnsx -l recon/subdomains/all.txt -silent -o recon/subdomains/resolved.txt

```

### 4. Probe HTTP/HTTPS

```bash
httpx -l recon/subdomains/resolved.txt \
  -silent \
  -follow-host-redirects \
  -status-code \
  -title \
  -tech-detect \
  -web-server \
  -content-length \
  -location \
  -json \
  -o recon/http/httpx.jsonl

cat recon/http/httpx.jsonl | jq -r '.url' | sort -u > recon/http/live.txt

```

### 5. Crawl Live Apps

```bash
katana -list recon/http/live.txt \
  -silent \
  -d 3 \
  -jc \
  -kf all \
  -o recon/urls/katana.txt

```

### 6. Collect Archived URLs

```bash
while read domain; do
  gau "$domain"
done < recon/scope/domains.txt | sort -u > recon/urls/archived.txt

```

### 7. Merge URLs

```bash
cat recon/urls/katana.txt recon/urls/archived.txt 2>/dev/null \
  | sort -u > recon/urls/all_urls.txt

```

### 8. Extract JavaScript

```bash
cat recon/urls/all_urls.txt \
  | grep -Ei '\.js($|\?)' \
  | sort -u > recon/js/js_files.txt

```

### 9. Extract Parameters

```bash
cat recon/urls/all_urls.txt \
  | grep '?' \
  | sed 's/.*?//' \
  | tr '&' '\n' \
  | cut -d '=' -f 1 \
  | sort -u > recon/params/parameters.txt

```

### 10. Find Interesting URLs

```bash
cat recon/urls/all_urls.txt \
  | grep -Ei '(admin|login|signup|register|reset|api|graphql|swagger|openapi|debug|actuator|upload|download|export|import|backup|old|dev|staging|test)' \
  | sort -u > recon/urls/interesting_urls.txt

```

---

## Minimal ffuf Recipes

### Advanced Directory & Context Discovery

Using automatic calibration (`-ac`) can fail in WAF environments or environments that return dynamic components (such as timestamps, random session hashes, or rotating nonces) on custom 404 views. Use explicit regex filtering rules and automated nested depth structures to discover deep trees cleanly.

```bash
ffuf -w wordlists/common.txt \
  -u https://example.com/FUZZ \
  -recursion -recursion-depth 2 \
  -extension-auth \
  -fr "timestamp|nonce|session|time" \
  -rate 20 \
  -t 10 \
  -o fuzzing/dirs.json \
  -of json

```

### File Discovery with Extensions

```bash
ffuf -w wordlists/common.txt \
  -u https://example.com/FUZZ \
  -e .php,.aspx,.jsp,.html,.js,.json,.txt,.bak,.old,.zip,.sql \
  -ac \
  -rate 20 \
  -t 10 \
  -o fuzzing/files.json \
  -of json

```

### Parameter Name Discovery

```bash
ffuf -w wordlists/parameters.txt \
  -u "https://example.com/search?FUZZ=test" \
  -ac \
  -rate 20 \
  -t 10 \
  -o params/ffuf_params.json \
  -of json

```

### Virtual Host Discovery

```bash
ffuf -w wordlists/subdomains.txt \
  -u https://example.com/ \
  -H "Host: FUZZ.example.com" \
  -ac \
  -rate 20 \
  -t 10 \
  -o fuzzing/vhosts.json \
  -of json

```

---

## Manual Review Checklist

| Area | Questions |
| --- | --- |
| **Authentication Flow** | Are sessions invalidated cleanly across both front and backend frameworks during logout? |
| **Input Surface** | Do exposed search parameters and filter workflows accept or explicitly display user input inside source tags? |
| **Multi-Tenancy** | Do headers or parameter keys reveal clear ID values tracking tenant boundaries (e.g., `?tenant_id=X`)? |
| **File Logic** | Does the application accept uploads, and what frameworks handle extension filtering on data streams? |

---

## Quick Recon Checklist

- [ ] Scope confirmed
- [ ] Exclusions recorded
- [ ] Passive subdomain enumeration done
- [ ] Active subdomain discovery done if allowed
- [ ] Wildcard DNS handled
- [ ] Live HTTP/HTTPS hosts identified
- [ ] Screenshots reviewed
- [ ] Technologies fingerprinted
- [ ] Main apps grouped
- [ ] Manual browsing performed through proxy
- [ ] Crawling completed
- [ ] Archived URLs collected
- [ ] Directory/file discovery completed
- [ ] Parameter list built
- [ ] JavaScript files collected
- [ ] Source maps checked
- [ ] API documentation checked
- [ ] GraphQL checked
- [ ] WebSockets checked
- [ ] Auth and roles mapped
- [ ] Interesting files checked
- [ ] Headers collected
- [ ] Cloud/SaaS hints reviewed
- [ ] Subdomain takeover candidates noted
- [ ] Findings mapped to next tests


---

## References

* [https://hacktricks.wiki/en/pentesting-web/web-vulnerabilities-methodology.html](https://hacktricks.wiki/en/pentesting-web/web-vulnerabilities-methodology.html)
* [https://hacktricks.wiki/en/generic-methodologies-and-resources/pentesting-methodology.html](https://hacktricks.wiki/en/generic-methodologies-and-resources/pentesting-methodology.html)
* [https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/01-Information_Gathering/](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/01-Information_Gathering/)
* [https://portswigger.net/support/recon-and-analysis-with-burp-suite](https://portswigger.net/support/recon-and-analysis-with-burp-suite)
* [https://portswigger.net/burp/documentation/desktop/tools/engagement-tools/content-discovery](https://portswigger.net/burp/documentation/desktop/tools/engagement-tools/content-discovery)
* [https://github.com/owasp-amass/amass](https://github.com/owasp-amass/amass)
* [https://owasp-amass.github.io/docs/](https://owasp-amass.github.io/docs/)
* [https://github.com/ffuf/ffuf](https://github.com/ffuf/ffuf)