# Server-Side Template Injection — SSTI

## Introduction

Server-Side Template Injection, usually shortened to **SSTI**, is a vulnerability where user-controlled input is interpreted as template syntax by a server-side template engine.

The key idea:

```text
User input  →  template engine  →  server-side evaluation
```
This is dangerous because template engines often have access to application objects, configuration values, helper functions, framework internals, file access, and sometimes operating system execution primitives.

SSTI can lead to:

* template expression evaluation
* server-side logic manipulation
* sensitive variable disclosure
* framework object exposure
* application configuration disclosure
* environment variable disclosure
* arbitrary file read in some engines
* arbitrary file write in some engines
* server-side request forgery through helper objects
* remote code execution in dangerous configurations
* sandbox escape
* full application and server compromise

---

## Useful Resources

* [Incendium SSTI Notes](https://notes.incendium.rocks/pentesting-notes/web/injection/server-side-template-injection)
* [HackTricks SSTI](https://hacktricks.wiki/en/pentesting-web/ssti-server-side-template-injection/index.html)
* [HackTricks Jinja2 SSTI](https://hacktricks.wiki/en/pentesting-web/ssti-server-side-template-injection/jinja2-ssti.html)
* [PortSwigger SSTI](https://portswigger.net/web-security/server-side-template-injection)
* [PortSwigger SSTI Research](https://portswigger.net/research/server-side-template-injection)
* [OWASP WSTG Testing for SSTI](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/18-Testing_for_Server_Side_Template_Injection)
* [PayloadsAllTheThings SSTI](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection)
* [Tplmap](https://github.com/epinna/tplmap)
* [Fenjing](https://github.com/Marven11/Fenjing)

---

## Basics

Most SSTI testing is about answering seven questions:

1. **Is user input reflected?**
   Example: username, email template, notification title, preview text, search result, report name.

2. **Is the input reflected as plain text or evaluated as template syntax?**
   Example: `{{7*7}}` becomes `49`.

3. **Which template engine is used?**
   Example: Jinja2, Twig, FreeMarker, Velocity, ERB, Smarty, Handlebars, Pug, EJS, Thymeleaf.

4. **Which context is the input placed into?**
   Example: text context, statement context, attribute context, string context, code block, email template, PDF template.

5. **What objects are exposed?**
   Example: `request`, `config`, `self`, `session`, `app`, `user`, helper functions.

6. **Is the engine sandboxed?**
   A sandbox may block dangerous operations, but sandboxes are often bypassable when dangerous objects are exposed.

7. **What is the safest proof of impact?**
   Start with arithmetic or harmless markers before attempting file reads, environment disclosure, or command execution.

A vulnerable flow often looks like this:

```text
User submits:
    name={{7*7}}

Application builds template:
    Hello {{7*7}}

Template engine renders:
    Hello 49
```
A safer flow should look like this:

```text
Template:
    Hello {{ name }}

Data:
    name = "{{7*7}}"

Rendered output:
    Hello {{7*7}}
```
The difference is critical:

```text
Vulnerable: user input becomes part of the template.
Safe: user input is passed as data into a fixed template.
```
---

## SSTI vs XSS

| Vulnerability | Where payload executes                 | Main risk                                              |
| ------------- | -------------------------------------- | ------------------------------------------------------ |
| XSS           | Victim’s browser                       | Session theft, actions as user, client-side compromise |
| CSTI          | Client-side template engine in browser | DOM manipulation, XSS-like impact                      |
| SSTI          | Server-side template engine            | Server-side data exposure, file access, RCE            |

Important distinction:

```text
XSS payloads execute in the browser.
SSTI payloads execute on the server.
```
SSTI can be mistaken for XSS because the payload is often reflected in HTML. The important test is whether server-side expressions are evaluated before the response reaches the browser.

Example:

```text
Input:
    {{7*7}}

If response contains:
    {{7*7}}       → probably plain reflection
    49            → possible SSTI
    error/stack   → possible SSTI or template parsing issue
```
---

## Common Template Engines

| Language / Stack | Template engines                                             |
| ---------------- | ------------------------------------------------------------ |
| Python           | Jinja2, Django Templates, Mako, Tornado                      |
| PHP              | Twig, Smarty, Blade, Plates                                  |
| Java             | FreeMarker, Velocity, Thymeleaf, Pebble, JSP/EL              |
| Ruby             | ERB, Slim, Liquid                                            |
| Node.js          | Handlebars, Mustache, Pug/Jade, EJS, Nunjucks, JsRender      |
| Go               | `text/template`, `html/template`                             |
| .NET             | Razor                                                        |
| CMS / Wiki       | Liquid, Twig, Velocity, Freemarker, custom template syntaxes |

Common framework mappings:

```text
Flask       → Jinja2
Django      → Django Templates, sometimes Jinja2
Symfony     → Twig
Laravel     → Blade
Spring      → Thymeleaf, FreeMarker, Velocity
Express     → Pug, EJS, Handlebars, Nunjucks
Rails       → ERB, Slim, Liquid
Hugo        → Go templates
Shopify     → Liquid
```
---

## Main SSTI Types

| Type                           | Meaning                                                     | Typical signal                                               |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Basic expression SSTI          | Arithmetic or expression evaluates.                         | `{{7*7}}` → `49`.                                            |
| Error-based SSTI               | Invalid syntax triggers template error.                     | Stack trace, parser error, template exception.               |
| Blind SSTI                     | Payload executes but output is not reflected.               | Delay, OAST callback, log entry, email side effect.          |
| Semi-blind SSTI                | Output hidden, but behavior changes.                        | Different status, response length, timing, or email content. |
| Sandboxed SSTI                 | Template evaluates but dangerous operations are restricted. | Arithmetic works, object access blocked.                     |
| Context-dependent SSTI         | Payload only works in the correct template context.         | Statement vs expression vs string context.                   |
| Second-order SSTI              | Payload is stored and rendered later.                       | Email templates, reports, admin previews, invoices.          |
| Client-side template injection | Browser-side template evaluation.                           | Angular/Vue/etc. evaluates in client, not server.            |

---

## Where to Test

Test any place where user input may be merged into a rendered template.

| Location             | Examples                                            |
| -------------------- | --------------------------------------------------- |
| Profile fields       | display name, bio, company, job title               |
| Email templates      | greeting, subject, footer, custom notification text |
| Admin templates      | CMS pages, custom blocks, theme editor              |
| Report generators    | PDF exports, invoices, dashboards                   |
| Error pages          | custom error messages, support reference pages      |
| Search pages         | search term reflected in result templates           |
| Notification systems | Slack/Teams/email message templates                 |
| Ticketing systems    | ticket title, customer name, internal note          |
| PDF generation       | HTML-to-PDF templates                               |
| Document generation  | DOCX/ODT templates                                  |
| CMS preview          | page title, SEO title, meta description             |
| Webhook templates    | custom body, URL, headers                           |
| Marketing tools      | personalized campaigns                              |
| Template editors     | admin-created snippets or partials                  |
| SSTI in path         | route parameter rendered by server                  |
| SSTI in headers      | logs, debug pages, email headers                    |
| Second-order places  | stored data rendered by background jobs             |

High-value parameter names:

```text
name
username
displayName
firstName
lastName
title
subject
message
body
content
template
preview
description
bio
company
search
query
error
return
email
footer
header
notification
comment
note
markdown
html
page
slug
filename
report
invoice
```
Interesting routes:

```text
/profile
/account
/settings
/search
/contact
/support
/tickets
/admin/templates
/admin/pages
/cms
/preview
/render
/template
/email/preview
/notifications
/reports
/export
/pdf
/invoice
/error
/debug
```
---

## Safe Testing Workflow

1. Confirm scope and authorization.
2. Identify reflected input.
3. Use a unique harmless marker:

```text
ssti-test-73921
```
4. Test basic template metacharacters:

```text
${{<%[%'"}}%\
```
5. Test simple arithmetic payloads.
6. Compare raw input and rendered output.
7. Identify the template engine.
8. Confirm the rendering context.
9. Enumerate exposed safe objects if allowed.
10. Avoid destructive payloads.
11. Do not attempt persistence, reverse shells, or credential use unless explicitly authorized.
12. Prove impact with minimum safe evidence.

Good low-impact proof payloads:

```text
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
[[${7*7}]]
{{"ssti-test-73921"}}
```
Avoid as first proof:

```text
reading sensitive files
dumping environment secrets
executing shell commands
writing files
calling internal network services
creating users
modifying templates persistently
reverse shells
```
---

## First Probe Payloads

Start with arithmetic and string markers.

```text
{{7*7}}
${7*7}
<%= 7*7 %>
<% 7*7 %>
#{7*7}
*{7*7}
[[${7*7}]]
{{ 7 * 7 }}
{{ "ssti-test-73921" }}
${"ssti-test-73921"}
<%= "ssti-test-73921" %>
```
Expected results:

```text
49                    → expression evaluated
7777777               → possible string multiplication, often Python/Jinja-like
payload unchanged     → probably not evaluated or wrong context
template error        → possible SSTI, wrong syntax, or blocked characters
500 response          → possible parser error
blank output          → payload evaluated but returned null/empty
```
Fuzzing string:

```text
${{<%[%'"}}%\
```
Use it carefully. It is noisy and may trigger errors.

---

## Engine Fingerprinting

Different engines evaluate different syntax.

| Payload                 | Possible engine family if evaluated                                    |
| ----------------------- | ---------------------------------------------------------------------- |
| `{{7*7}}` → `49`        | Jinja2, Twig, Nunjucks, Handlebars-like, Go templates in some contexts |
| `${7*7}` → `49`         | FreeMarker, SpringEL, Thymeleaf, JSP EL                                |
| `<%= 7*7 %>` → `49`     | ERB, EJS                                                               |
| `#{7*7}` → `49`         | Pug/Jade, FreeMarker legacy style, some Java expression contexts       |
| `[[${7*7}]]` → `49`     | Thymeleaf inline expression                                            |
| `{{7*'7'}}` → `7777777` | Python/Jinja-like behavior                                             |
| `{{7*'7'}}` → error     | Twig-like or stricter engine                                           |
| `{{foobar}}` → empty    | Jinja2-like undefined handling                                         |
| `{{foobar}}` → error    | Some strict engines or debug mode                                      |

Basic decision tree:

```text
{{7*7}} = 49?
    yes → test {{7*'7'}}
        7777777 → likely Jinja2/Python-like
        error/empty → test Twig/Nunjucks/Handlebars behavior
${7*7} = 49?
    yes → test Java/FreeMarker/Thymeleaf/SpringEL style
<%= 7*7 %> = 49?
    yes → test ERB/EJS style
#{7*7} = 49?
    yes → test Pug/Jade or Java template contexts
[[${7*7}]] = 49?
    yes → test Thymeleaf inline context
```
---

## Context Matters

SSTI payloads are context-dependent. The same payload may work in one place and fail elsewhere.

### Plain Text Context

Example template:

```text
Hello USER_INPUT
```
Payload:

```text
{{7*7}}
```
Rendered result:

```text
Hello 49
```
### HTML Attribute Context

Example:

```html
<input value="USER_INPUT">
```
Payload may need to break out of quotes or remain expression-only.

```text
{{7*7}}
"{{7*7}}"
```
### JavaScript String Context

Example:

```html
<script>
  const name = "USER_INPUT";
</script>
```
This may become XSS, SSTI, or both depending on whether the value is evaluated server-side before being placed into JavaScript.

### Statement Context

Some engines use statement tags:

```text
{% if condition %}
{% for item in items %}
{% set x = 1 %}
```
Jinja/Twig-style tests:

```text
{% if 7*7 == 49 %}ssti-test-73921{% endif %}
{% set x = 7*7 %}{{x}}
```
### Template Attribute Context

Some engines, such as Thymeleaf, evaluate expressions inside special attributes.

Example shape:

```html
<p th:text="${message}">placeholder</p>
```
Potential test:

```text
[[${7*7}]]
```
---

## Common Detection Signals

| Signal                           | Meaning                                       |
| -------------------------------- | --------------------------------------------- |
| `{{7*7}}` becomes `49`           | Expression evaluation confirmed.              |
| `{{7*'7'}}` becomes `7777777`    | Python-like expression behavior.              |
| Template syntax error            | Payload reached parser.                       |
| Stack trace contains engine name | Engine identified.                            |
| Response time changes            | Possible blind evaluation.                    |
| OAST callback occurs             | Possible blind execution/helper call.         |
| Undefined variable behavior      | Helps fingerprint engine.                     |
| HTML escaping changes            | Template engine escaping/filtering observed.  |
| Different response length        | Payload altered rendered output.              |
| Blank output                     | Expression evaluated to null/undefined/empty. |

Possible engine names in errors:

```text
Jinja2
Twig
FreeMarker
Velocity
Thymeleaf
Smarty
Mako
Tornado
ERB
EJS
Pug
Jade
Handlebars
Mustache
Nunjucks
Liquid
Razor
Django
Pebble
```
---

## Verbose SSTI

Verbose SSTI means the evaluated expression appears in the response.

Example vulnerable request:

```http
GET /hello?name={{7*7}} HTTP/1.1
Host: vulnerable.example
```
Possible response:

```html
Hello 49
```
Safer proof marker:

```text
{{"ssti-test-73921"}}
```
Possible response:

```text
ssti-test-73921
```
This is enough to prove server-side template expression evaluation in many cases.

---

## Error-Based SSTI

Template parsing errors are useful for detection and fingerprinting.

Payloads:

```text
{{}
${}
<%=
{{7*
{{foobar
{% if %}
${{<%[%'"}}%\
```
Interesting error strings:

```text
TemplateSyntaxError
TemplateRuntimeError
UndefinedError
Jinja2
Twig_Error_Syntax
Twig\Error\SyntaxError
freemarker.core.ParseException
org.thymeleaf.exceptions.TemplateInputException
VelocityException
ActionView::Template::Error
ERB
EJS
Handlebars
Liquid syntax error
```
Do not assume every template error means exploitable SSTI. It may only indicate that a template parser saw your input. Confirm with a controlled expression.

---

## Blind SSTI

Blind SSTI occurs when the payload is evaluated but output is not returned.

Detection methods:

```text
time delay
DNS callback
HTTP callback
email side effect
log side effect
conditional response changes
template error differences
```
### Time-Based Proof

Use only when a safe time function is available in the engine/context.

Conceptual examples:

```text
expression causes a 3–5 second delay
baseline response remains fast
delay repeats consistently
```
Good timing methodology:

```text
baseline request
delay 3 seconds
baseline request
delay 5 seconds
baseline request
repeat once
```
Timing alone can be noisy. Prefer a second signal when possible.

### OAST Proof

Use a unique controlled domain:

```text
ssti-test-73921.oast.example
```
Possible signals:

```text
DNS lookup
HTTP request
source IP
User-Agent
timestamp
unique path
```
Only use static markers first. Do not exfiltrate secrets unless explicitly authorized.

---

## Second-Order SSTI

Second-order SSTI happens when the payload is stored first and rendered later.

Examples:

```text
profile name rendered in email
company name rendered in invoice
ticket title rendered in admin panel
CMS page title rendered during preview
report name rendered in PDF
notification template rendered by background worker
webhook body template rendered later
Markdown content converted to a template
```
Testing approach:

```text
1. Store a harmless marker payload.
2. Trigger the feature that renders it.
3. Check user-facing output, admin output, email, PDF, report, or logs.
4. Use unique markers per field.
5. Avoid destructive payloads.
```
Example stored payload:

```text
{{7*7}}-ssti-test-73921
```
Possible result later:

```text
49-ssti-test-73921
```
---

## Jinja2 / Python

Common in Flask and Python applications.

Basic probes:

```text
{{7*7}}
{{7*'7'}}
{{"ssti-test-73921"}}
{% if 7*7 == 49 %}ssti-test-73921{% endif %}
```
Possible signals:

```text
{{7*7}}      → 49
{{7*'7'}}    → 7777777
{{foobar}}   → empty or undefined behavior
```
Common exposed objects in Flask/Jinja contexts:

```text
config
request
session
g
url_for
get_flashed_messages
self
cycler
joiner
namespace
lipsum
```
Safe enumeration examples:

```text
{{config}}
{{request}}
{{self}}
{{request.method}}
{{request.path}}
```
Statement-style probes:

```text
{% set x = 7*7 %}{{x}}
{% if 7*7 == 49 %}OK{% endif %}
{% for x in range(3) %}{{x}}{% endfor %}
```
Character/filter bypass ideas:

```text
{{request|attr("__class__")}}
{{request["__class__"]}}
{{request|attr(["__","class","__"]|join)}}
```
Safer impact proof:

```text
{{"ssti-test-73921"}}
{{7*7}}
{{request.path}}
```
Do not jump directly to shell execution. Prove template evaluation first, then assess exposed objects and sandboxing.

---

## Twig / PHP

Common in Symfony and PHP applications.

Basic probes:

```text
{{7*7}}
{{7*'7'}}
{{"ssti-test-73921"}}
```
Possible signals:

```text
{{7*7}}      → 49
{{7*'7'}}    → error or different behavior than Jinja
```
Useful safe probes:

```text
{{_self}}
{{app}}
{{app.request}}
{{app.environment}}
```
Filter-style behavior:

```text
{{"ssti-test-73921"|upper}}
{{"SSTI-TEST"|lower}}
```
Possible result:

```text
SSTI-TEST-73921
ssti-test
```
Twig may be sandboxed depending on configuration. Sandbox escape depends heavily on version, enabled filters, custom functions, and exposed objects.

---

## FreeMarker / Java

Common in Java applications.

Basic probes:

```text
${7*7}
#{7*7}
${"ssti-test-73921"}
```
Possible signals:

```text
${7*7}      → 49
#{7*7}      → 49 in some legacy contexts
```
Safe object/probe ideas:

```text
${.version}
${.now}
${"ssti-test-73921"?upper_case}
```
FreeMarker impact depends on configuration, object wrapper, exposed classes, template loader, and sandboxing. Dangerous class access should be treated as high impact and tested only with explicit authorization.

---

## Velocity / Java

Basic probes:

```text
#set($x=7*7)$x
#set($x="ssti-test-73921")$x
```
Possible signal:

```text
49
ssti-test-73921
```
Common syntax:

```text
$variable
#set($x = "value")
#if($x) yes #end
#foreach($i in [1..3])$i#end
```
Velocity risk depends on exposed objects and tools. If dangerous Java objects or reflection helpers are exposed, impact can become severe.

---

## Thymeleaf / Spring

Common in Java Spring applications.

Basic probes:

```text
${7*7}
[[${7*7}]]
[( ${7*7} )]
```
Possible signal:

```text
[[${7*7}]]  → 49
```
Thymeleaf often evaluates expressions inside template attributes or inline expression contexts.

Example contexts:

```html
<p th:text="${message}"></p>
<p>[[${message}]]</p>
```
Safe probes:

```text
[[${"ssti-test-73921"}]]
[[${7*7}]]
```
High-impact exploitation often depends on SpringEL/OGNL expression access and application-specific configuration.

---

## ERB / Ruby

Common in Ruby/Rails contexts.

Basic probes:

```text
<%= 7*7 %>
<%= "ssti-test-73921" %>
```
Possible signal:

```text
49
ssti-test-73921
```
ERB executes Ruby code in templates, so unsafe user-controlled template construction is high risk.

Safe probes:

```text
<%= 1 + 1 %>
<%= "ssti-test-73921" %>
```
Avoid destructive Ruby execution payloads unless explicitly authorized.

---

## EJS / Node.js

Common in Express/Node.js applications.

Basic probes:

```text
<%= 7*7 %>
<%= "ssti-test-73921" %>
```
Possible signal:

```text
49
ssti-test-73921
```
EJS-like engines may support:

```text
<%= expression %>
<%- unescapedExpression %>
<% code %>
```
Safe probes:

```text
<%= 7*7 %>
<%= process.version %>
```
`process.version` discloses runtime info and should be considered more sensitive than arithmetic.

---

## Pug / Jade / Node.js

Basic probes:

```text
#{7*7}
#{'ssti-test-73921'}
```
Possible signal:

```text
49
ssti-test-73921
```
Pug syntax is indentation-sensitive in full templates. Inline interpolation may work in specific contexts:

```text
p #{7*7}
```
Impact depends on whether attacker input becomes a full Pug template or only data inside a fixed template.

---

## Handlebars / Mustache

Basic probes:

```text
{{this}}
{{.}}
{{name}}
```
Handlebars and Mustache are often logic-light, so basic arithmetic may not work:

```text
{{7*7}} may not evaluate
```
Test whether variables or helpers are exposed:

```text
{{constructor}}
{{lookup this "name"}}
{{#if this}}OK{{/if}}
```
Impact depends on helper functions, unsafe runtime options, prototype access, and custom helpers.

---

## Liquid

Common in Shopify-like templating and some Ruby/CMS environments.

Basic probes:

```text
{{ 7 | plus: 7 }}
{{ "ssti-test-73921" }}
```
Possible signal:

```text
14
ssti-test-73921
```
Liquid is usually more restricted than engines that expose full language execution, but sensitive object exposure may still create impact.

---

## Go Templates

Common in Go applications, Hugo-like systems, and internal tools.

Basic probes:

```text
{{.}}
{{printf "ssti-test-73921"}}
{{printf "%d" 49}}
```
Go templates are not automatically RCE. Impact depends on exposed functions and data structures.

Safe probes:

```text
{{.}}
{{printf "ssti-test-73921"}}
```
---

## Django Templates

Django templates are intentionally more restricted than Jinja2, but SSTI can still expose sensitive data depending on context and custom tags/filters.

Basic probes:

```text
{{7}}
{{7|add:7}}
{{"ssti-test-73921"}}
```
Possible signal:

```text
14
ssti-test-73921
```
Impact depends heavily on available context variables, custom filters, debug mode, and template tags.

---

## Mako / Python

Mako can execute Python-like expressions in templates.

Basic probes:

```text
${7*7}
${"ssti-test-73921"}
```
Possible signal:

```text
49
ssti-test-73921
```
Mako can be high impact if attacker input becomes a template, because it supports powerful Python expression/code features.

---

## Smarty / PHP

Basic probes:

```text
{$smarty.version}
{7*7}
{"ssti-test-73921"}
```
Possible signals:

```text
Smarty version appears
49
ssti-test-73921
```
Smarty impact depends on version, security mode, plugins, and exposed variables.

---

## Tornado / Python

Basic probes:

```text
{{7*7}}
{{"ssti-test-73921"}}
{% set x = 7*7 %}{{x}}
```
Possible signal:

```text
49
ssti-test-73921
```
Tornado templates support Python expressions and may become high impact if attacker-controlled strings are compiled as templates.

---

## Blind / OAST SSTI Patterns

Use unique markers.

```text
ssti-probe-73921.oast.example
```
Possible confirmation methods:

```text
DNS callback
HTTP callback
timing difference
conditional content difference
email body difference
PDF content difference
log entry
```
Safe OAST strategy:

```text
1. First prove expression evaluation with arithmetic.
2. Then test whether network-capable helpers are exposed.
3. Use a unique domain per endpoint/parameter.
4. Do not exfiltrate secrets.
5. Record timestamp, source IP, User-Agent, and request path.
```
Example evidence wording:

```text
The payload caused a DNS lookup to ssti-probe-73921.oast.example from the application server. No sensitive data was exfiltrated.
```
---

## Object Exploration

Once SSTI is confirmed, enumerate carefully.

Safe objects to check:

```text
self
this
request
session
config
app
user
context
environment
settings
globals
```
Safe questions:

```text
What engine is this?
What framework is this?
What variables are exposed?
Is debug mode enabled?
Is sandbox mode enabled?
Are custom filters/functions exposed?
Are dangerous helpers present?
```
Avoid immediately dumping all configuration if it may contain secrets. Prefer minimal proof such as:

```text
framework name
template engine version
request path
current username
non-sensitive test config key
```
---

## Bypass Techniques

SSTI filters often block obvious characters or strings.

Common blocked items:

```text
{{
}}
{%
%}
.
_
[
]
'
"
import
class
subclasses
config
request
os
popen
eval
exec
```
Bypass families:

```text
alternate delimiters
statement tags instead of expression tags
attribute filters
string concatenation
join filters
hex encoding
unicode escapes
request parameter smuggling
headers as string sources
case changes
template comments
line breaks
context switching
```
---

## Delimiter Bypasses

If `{{ }}` is blocked, try statement syntax.

Jinja/Twig-like:

```text
{% if 7*7 == 49 %}ssti-test-73921{% endif %}
{% set x = 7*7 %}{{x}}
```
Thymeleaf-like:

```text
[[${7*7}]]
[( ${7*7} )]
```
ERB/EJS-like:

```text
<%= 7*7 %>
```
Pug-like:

```text
#{7*7}
```
FreeMarker-like:

```text
${7*7}
#{7*7}
```
---

## Dot / Attribute Bypasses

If `.` is blocked, try bracket or filter-style access.

Jinja-like examples:

```text
{{request["class"]}}
{{request|attr("path")}}
{{request|attr("__class__")}}
```
String construction:

```text
{{request|attr(["__","class","__"]|join)}}
```
Header/parameter-sourced attribute names:

```text
{{request|attr(request.args.attr)}}
```
With request:

```text
?attr=path
```
This can bypass filters that only inspect the payload body but not auxiliary parameters or headers.

---

## Underscore Bypasses

If `_` is blocked, try encoding or string construction.

```text
\x5f
\u005f
["_"*2,"class","_"*2]|join
request.args.underscore
request.headers.underscore
```
Example idea:

```text
{{request|attr(["_"*2,"class","_"*2]|join)}}
```
Avoid using these directly against production unless you already have authorization to test bypasses.

---

## Quote Bypasses

If quotes are blocked:

```text
use request parameters as strings
use headers as strings
use existing variables
use join/concat functions
use numeric operations
use template variables already in scope
```
Example idea:

```text
{{request|attr(request.args.x)}}
```
With:

```text
?x=path
```
---

## Bracket Bypasses

If `[` and `]` are blocked:

```text
use attr()
use dot notation
use first/last filters
use pop-like helpers if exposed
use get/list helpers if available
```
Example:

```text
{{request|attr("path")}}
```
---

## Encoding Bypasses

URL encoding:

```text
%7B%7B7*7%7D%7D
%24%7B7*7%7D
%3C%25%3D%207*7%20%25%3E
```
Double encoding:

```text
%257B%257B7*7%257D%257D
```
Unicode escapes where supported:

```text
\u007b\u007b7*7\u007d\u007d
```
HTML entity encoding may matter if the input is decoded before template rendering:

```text
&#123;&#123;7*7&#125;&#125;
```
---

## Sandbox Notes

A sandboxed template environment may allow harmless expressions but block dangerous operations.

Possible signs of sandboxing:

```text
arithmetic works
attribute access blocked
method calls blocked
dangerous filters missing
class/object access denied
security exception appears
```
Example signals:

```text
SecurityError
access to attribute is unsafe
not allowed to access
sandbox violation
undefined function
method not permitted
```
Sandbox escape depends on:

```text
template engine
engine version
framework integration
custom filters
custom functions
exposed objects
debug extensions
allowed method calls
available imports/classes
```
Treat sandbox escape testing as higher risk. Use safe probes first.

---

## SSTI in Emails

Email templates are common second-order SSTI locations.

Examples:

```text
Hello {{first_name}}
Your ticket {{ticket_id}} was updated.
Dear ${customerName}
```
Risky feature:

```text
admin can customize email greeting using user-controlled input
user-controlled profile fields are concatenated into the email template
```
Test:

```text
first_name={{7*7}}-ssti-test-73921
```
Check:

```text
email body
email subject
HTML version
plain-text version
admin preview
queued email logs
```
---

## SSTI in PDF / Document Generation

Document generation often uses templates.

Targets:

```text
PDF invoices
DOCX exports
ODT templates
HTML-to-PDF reports
certificates
badges
shipping labels
contracts
```
Safe test:

```text
{{7*7}}-ssti-test-73921
```
Check:

```text
generated PDF body
document metadata
header/footer
table cells
email attachment
background job logs
```
PDF generators may also have SSRF or local file read issues. Keep SSTI and renderer issues separated in the report unless chained impact is confirmed.

---

## SSTI in CMS / Admin Template Editors

CMS and admin template editors are tricky because some users are intentionally allowed to edit templates.

Ask:

```text
Is the user expected to write templates?
Is the user trusted?
Can low-privileged users edit templates?
Can template editors access dangerous objects?
Is sandbox mode enforced?
Can templates be used to read secrets or execute code?
Can template changes affect other users?
```
Potential impact:

```text
stored XSS
privilege escalation
sensitive data exposure
RCE
tenant breakout in multi-tenant systems
```
If only full administrators can edit templates, this may be intended functionality, but it can still be a hardening issue if templates expose OS or secret access unnecessarily.

---

## SSTI in Webhooks / Notification Templates

Webhook systems often allow body templates.

Example:

```json
{
  "text": "Ticket {{ticket.id}} updated by {{user.name}}"
}
```
Risky pattern:

```text
user-controlled fields are concatenated into the webhook template before rendering
```
Test:

```text
webhookName={{7*7}}-ssti-test-73921
```
Check:

```text
webhook body
webhook headers
delivery logs
retry logs
admin preview
```
---

## Common False Positives

| Situation                       | Why it can mislead                                           |
| ------------------------------- | ------------------------------------------------------------ |
| Input reflected unchanged       | Reflection alone is not SSTI.                                |
| JavaScript evaluates expression | Could be CSTI or XSS, not SSTI.                              |
| Calculator-like feature         | App intentionally evaluates math, not template syntax.       |
| Markdown rendering              | Markdown output is not template execution by itself.         |
| WAF block page                  | Error caused by WAF, not template engine.                    |
| 500 error only                  | Could be validation or parser failure, not exploitable SSTI. |
| Escaped output                  | Template may be safely rendering user input as data.         |
| Admin-only template editor      | May be intended functionality depending on role.             |
| Client-side framework           | Angular/Vue/Handlebars in browser may be CSTI.               |

Confirm with:

```text
server-side arithmetic
engine-specific syntax
response before browser execution
disabled JavaScript test
raw HTTP response comparison
second payload with different syntax
error message naming template engine
```
---

## Tools

### Burp Suite

Useful for:

```text
capturing requests
Repeater testing
payload variations
Intruder fuzzing
Collaborator/OAST callbacks
response comparison
timing comparison
```
### Tplmap

Automated SSTI scanner/exploitation tool.

Example shape:

```bash
tplmap -u "https://target.example/?name=INJECT"
```
Use carefully:

```text
authorized scope only
review payloads first
rate-limit requests
avoid destructive modules
avoid automatic shell modes unless explicitly allowed
```
### Fenjing

Useful for Jinja-focused filter bypass testing.

```bash
python -m fenjing scan --url "https://target.example/"
```
Use primarily in labs or authorized environments.

### Manual Wordlists

Useful categories:

```text
basic arithmetic
engine-specific delimiters
context-breaking payloads
error probes
safe object probes
filter bypass probes
blind/OAST probes
```
---

## Impact Chaining

SSTI is often the start of a deeper compromise.

Common chains:

```text
SSTI → config disclosure
SSTI → environment variable disclosure
SSTI → file read
SSTI → secret/key disclosure
SSTI → cloud credential access
SSTI → SSRF via helper functions
SSTI → command execution
SSTI → template modification
SSTI → stored XSS in rendered output
SSTI → tenant data exposure
SSTI → full server compromise
```
Cloud/container things to check only in authorized environments:

```text
environment variables
mounted secrets
service account tokens
cloud metadata reachability
application config files
Kubernetes service account files
CI/CD variables
```
Avoid using discovered credentials unless the rules of engagement explicitly allow it.


## Manual SSTI Checklist

### Discovery

* [ ] Identified reflected input.
* [ ] Checked profile fields, search, emails, reports, PDFs, CMS previews, admin templates, and notifications.
* [ ] Checked stored fields for second-order rendering.
* [ ] Used a unique harmless marker.
* [ ] Compared raw HTTP response, not only browser-rendered output.
* [ ] Disabled JavaScript when checking for server-side vs client-side evaluation.

### Basic Testing

* [ ] Tested `{{7*7}}`.
* [ ] Tested `${7*7}`.
* [ ] Tested `<%= 7*7 %>`.
* [ ] Tested `#{7*7}`.
* [ ] Tested `[[${7*7}]]`.
* [ ] Tested a template metacharacter fuzz string.
* [ ] Checked for template errors.
* [ ] Confirmed actual evaluation, not reflection.

### Engine Fingerprinting

* [ ] Tested engine-specific delimiters.
* [ ] Tested string multiplication behavior.
* [ ] Checked error messages.
* [ ] Checked response differences.
* [ ] Identified framework or stack.
* [ ] Checked template engine version if safely exposed.
* [ ] Confirmed rendering context.

### Context Testing

* [ ] Tested text context.
* [ ] Tested HTML attribute context.
* [ ] Tested JavaScript string context.
* [ ] Tested statement context.
* [ ] Tested email/PDF context.
* [ ] Tested second-order rendering.
* [ ] Checked whether payload requires quote/context breaking.

### Object Exploration

* [ ] Checked safe objects only first.
* [ ] Checked `self` / `this`.
* [ ] Checked request path or method.
* [ ] Checked non-sensitive framework info.
* [ ] Avoided dumping secrets as first proof.
* [ ] Checked whether sandboxing blocks dangerous access.

### Blind Testing

* [ ] Tested baseline timing.
* [ ] Tested conditional rendering.
* [ ] Tested OAST only with static markers.
* [ ] Used unique OAST domain per parameter.
* [ ] Checked DNS and HTTP callbacks.
* [ ] Avoided exfiltrating secrets unless explicitly authorized.

### Bypass Testing

* [ ] Tested alternate delimiters.
* [ ] Tested statement tags instead of expression tags.
* [ ] Tested URL encoding.
* [ ] Tested double encoding.
* [ ] Tested dot bypasses.
* [ ] Tested underscore bypasses.
* [ ] Tested quote bypasses.
* [ ] Tested bracket bypasses.
* [ ] Tested request-parameter-sourced strings.
* [ ] Tested headers as string sources where relevant.

### Impact

* [ ] Identified template engine.
* [ ] Identified execution context.
* [ ] Identified exposed objects.
* [ ] Confirmed whether sandboxed.
* [ ] Confirmed whether file read is possible only if allowed.
* [ ] Confirmed whether command execution is possible only if allowed.
* [ ] Documented minimum safe proof.
* [ ] Avoided persistence and destructive actions.


---

## Quick Payload Bank

Generic probes:

```text
{{7*7}}
${7*7}
<%= 7*7 %>
#{7*7}
[[${7*7}]]
{{"ssti-test-73921"}}
${"ssti-test-73921"}
<%= "ssti-test-73921" %>
```
Fuzzing string:

```text
${{<%[%'"}}%\
```
Jinja2 / Python:

```text
{{7*7}}
{{7*'7'}}
{{config}}
{{request.path}}
{% if 7*7 == 49 %}ssti-test-73921{% endif %}
{% set x = 7*7 %}{{x}}
```
Twig / PHP:

```text
{{7*7}}
{{"ssti-test-73921"}}
{{"ssti-test"|upper}}
{{_self}}
```
FreeMarker / Java:

```text
${7*7}
#{7*7}
${"ssti-test-73921"}
${.version}
${.now}
```
Velocity / Java:

```text
#set($x=7*7)$x
#set($x="ssti-test-73921")$x
```
Thymeleaf / Spring:

```text
${7*7}
[[${7*7}]]
[[${"ssti-test-73921"}]]
```
ERB / Ruby:

```text
<%= 7*7 %>
<%= "ssti-test-73921" %>
```
EJS / Node.js:

```text
<%= 7*7 %>
<%= "ssti-test-73921" %>
```
Pug / Jade:

```text
#{7*7}
#{'ssti-test-73921'}
```
Liquid:

```text
{{ 7 | plus: 7 }}
{{ "ssti-test-73921" }}
```
Go templates:

```text
{{.}}
{{printf "ssti-test-73921"}}
{{printf "%d" 49}}
```
Django templates:

```text
{{7}}
{{7|add:7}}
{{"ssti-test-73921"}}
```
Mako / Python:

```text
${7*7}
${"ssti-test-73921"}
```
Smarty / PHP:

```text
{$smarty.version}
{7*7}
{"ssti-test-73921"}
```
Tornado / Python:

```text
{{7*7}}
{{"ssti-test-73921"}}
{% set x = 7*7 %}{{x}}
```
Encoding:

```text
%7B%7B7*7%7D%7D
%24%7B7*7%7D
%3C%25%3D%207*7%20%25%3E
%257B%257B7*7%257D%257D
```
Second-order marker:

```text
{{7*7}}-ssti-test-73921
```
OAST marker:

```text
ssti-test-73921.oast.example
```