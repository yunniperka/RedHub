
# Cross-Site Scripting (XSS)

 

## What XSS is

  

Cross-Site Scripting (XSS) happens when an application lets attacker-controlled input become executable code in a victim's browser. The browser runs the injected code that can usually do anything the real page can do for that user.

  

Typical impact:

  

- Act as the victim inside the application.

- Read or change page content.

- Read data exposed to JavaScript, such as DOM data, `localStorage`, `sessionStorage`, and non-`HttpOnly` cookies.

- Send same-origin requests with the victim's cookies/session.

- Change account data if the application lacks extra controls.

- Create phishing UI inside the trusted application.

- Attack admins through stored or blind XSS.

  

Important nuance:

  

-  `HttpOnly` protects a cookie from `document.cookie`, but it does **not** stop XSS from making authenticated requests as the user.

-  `SameSite` helps against CSRF, but it does **not** fix XSS.

- CSP helps reduce impact, but it is not a replacement for correct encoding, sanitization, and safe DOM APIs.

  

---

  

## Main XSS types

  


| Type | Meaning | Typical place to test |
| --- | --- | --- |
| Reflected XSS | Payload comes from the current request and is immediately reflected in the response. | Query parameters, path, search fields, error messages, redirects. |
| Stored XSS | Payload is saved by the application and later shown to users. | Comments, profiles, tickets, chat, product descriptions, admin panels. |
| DOM-based XSS | Client-side JavaScript reads attacker-controlled data and passes it to a dangerous sink. | `location`, hash fragments, `postMessage`, storage, client-side routing. |
| Blind XSS | Stored XSS that triggers somewhere you cannot directly see, usually in an admin/backend panel. | Contact forms, logs, support tickets, CRM/admin views, import jobs. |


  

---

  

## Core testing methodology

  

#### Step 1 — Find controllable input

  

Test all input locations, not only obvious form fields:

  

- URL query parameters: `?q=test`

- URL path segments: `/search/test`

- URL fragment/hash: `#test`

- POST/JSON/form fields

- Cookies

- Headers that may be reflected, for example `User-Agent`, `Referer`, `X-Forwarded-For`

- File names and file metadata

- Uploaded SVG/HTML/Markdown/CSV content

- Profile fields, comments, tickets, logs, chat messages

- Import/export fields shown later in reports

-  `postMessage` data

- WebSocket or SSE messages

-  `localStorage` / `sessionStorage` values

  

Use a unique canary string first:

  

```text

xssprobe-73921

```

  

Then search for it in:

  

- The raw HTTP response.

- The browser DOM using DevTools.

- Later pages where stored data may appear.

- Admin/report views if in scope.

  

#### Step 2 — Identify the context

  

Do not throw random payloads. First identify where your input lands:

  


| Context | Example reflection | Main question |
| --- | --- | --- |
| HTML body | `<div>INPUT</div>` | Can you create a new tag or event? |
| HTML attribute | `<input value="INPUT">` | Can you break out of the attribute or inject a new attribute? |
| URL attribute | `<a href="INPUT">` | Can you control the protocol or full URL? |
| JavaScript string | `var x = 'INPUT';` | Can you break out of the string and repair syntax? |
| JavaScript template literal | ``const x = `INPUT`;`` | Can `${...}` be evaluated? |
| CSS | `<style>.x{color:INPUT}</style>` | Is the value constrained to a safe property/value? |
| HTML comment | `<!-- INPUT -->` | Can you close the comment? |
| Markdown/rich text | `INPUT` rendered through a parser | Does the renderer allow raw HTML or unsafe links? |

  

#### Step 3 — Test which characters survive

  

Check how the application handles important characters:

  

```text

< > " ' ` / \ = ( ) { } [ ] ; : & # %

```

  

Also check whether the application:

  

- Encodes characters.

- Removes characters.

- Normalizes Unicode.

- Double-decodes input.

- Decodes HTML entities inside attributes.

- Rewrites only the first occurrence of a character.

- Sanitizes before later modifying the HTML again.

  

#### Step 4 — Use a safe proof of execution

  

Good safe proof-of-concept payloads:

  

```html

<script>alert(document.domain)</script>

<img  src=x  onerror=alert(1)>

<svg  onload=alert(1)>

<script>print()</script>

```

  

For professional reports, `alert(1)` is often enough to prove execution. For stronger proof without stealing data, show:

  

```js

alert(location.origin)

```

  

or modify harmless page text:

  

```js

console.log('XSS confirmed on '  +  location.origin)

```

  

  

---

  

## Useful safe payloads by context

  

### HTML body context

  

Reflection:

  

```html

<div>INPUT</div>

```

  

Payloads:

  

```html

<script>alert(1)</script>

<img  src=x  onerror=alert(1)>

<svg  onload=alert(1)>

```

  

### Inside an HTML attribute

  

Reflection:

  

```html

<input  value="INPUT">

```

  

Payloads:

  

```html

" autofocus onfocus=alert(1) x="

"><img  src=x  onerror=alert(1)>

```

  

Notes:

  

- Try the matching quote first: `"` for double-quoted attributes, `'` for single-quoted attributes.

- If `>` is blocked, you may still be able to inject a new event attribute inside the same tag.

- Event attributes such as `onfocus`, `onerror`, `onclick`, `onmouseover`, and `onanimationstart` are dangerous when attacker-controlled.

  

### URL attribute context

  

Reflection:

  

```html

<a  href="INPUT">link</a>

```

  

Payload:

  

```html

javascript:alert(1)

```

  

Defensive note: applications should validate URL schemes. Usually allow only `http:`, `https:`, and sometimes relative URLs. Block `javascript:`, dangerous `data:` values, and malformed protocol tricks.

  

### JavaScript string context

  

Reflection:

  

```html

<script>

var  name  =  'INPUT';

</script>

```

  

Payload examples:

  

```js

';alert(1);//

'-alert(1)-'

```

  

What matters:

  

- Break out of the string.

- Execute JavaScript.

- Comment out or repair the remaining syntax.

  

### JavaScript template literal context

  

Reflection:

  

```js

const  message  =  `Welcome INPUT`;

```

  

Payload:

  

```js

${alert(1)}

```

  

Template literals are important because code inside `${...}` is evaluated as JavaScript.

  

### HTML comment context

  

Reflection:

  

```html

<!-- INPUT -->

```

  

Payload:

  

```html

--><img  src=x  onerror=alert(1)>

```

  

### Markdown or rich text context

  

Test whether raw HTML is allowed:

  

```markdown

<img  src=x  onerror=alert(1)>

```

  

Test unsafe links:

  

```markdown

[click](javascript:alert(1))

```

  

Defensive note: safe Markdown renderers should block raw HTML by default or sanitize it, and they must validate link protocols.

  

---

  

## DOM XSS

  

DOM XSS happens when browser-side JavaScript reads attacker-controlled data from a **source** and writes it into a dangerous **sink**.

  

### Common sources

  


| Source | Example |
| --- | --- |
| URL query | `location.search` |
| URL hash | `location.hash` |
| URL path | `location.pathname` |
| Full URL | `location.href` |
| Referrer | `document.referrer` |
| Window name | `window.name` |
| Messages | `window.addEventListener('message', ...)` |
| Storage | `localStorage`, `sessionStorage` |
| Cookies | `document.cookie` |
| DOM inputs | `input.value`, `element.dataset.*` |
| Network data | WebSocket, SSE, API responses |
| Client-side router state | route params, query params |

  

### Dangerous sinks

  


| Sink | Why risky |
| --- | --- |
| `innerHTML` / `outerHTML` | Parses string as HTML. |
| `insertAdjacentHTML()` | Parses string as HTML. |
| `document.write()` / `writeln()` | Writes HTML/JS into the page. |
| `eval()` | Executes string as JavaScript. |
| `Function()` | Builds executable JavaScript from a string. |
| `setTimeout(string)` / `setInterval(string)` | Executes string as JavaScript. |
| `location = ...` / `href = ...` | Dangerous if `javascript:` URLs are possible. |
| `setAttribute()` | Risky with `on*` attributes, `src`, `href`, `srcdoc`. |
| `iframe.srcdoc` | Direct HTML execution context. |
| `script.src` | Loads external JavaScript. |
| jQuery `.html()` | Parses string as HTML. |
| jQuery `.append()` / `.prepend()` / `.before()` / `.after()` | Dangerous when passed HTML strings. |
| jQuery `.attr('href', userInput)` | Dangerous if protocol is not validated. |

  

### Safer alternatives

  

Prefer APIs that treat data as text:

  

```js

// Unsafe

element.innerHTML  =  userInput;

// Safer

element.textContent  =  userInput;

```

  

Other safer sinks:

  

```js

element.textContent  =  value;

element.insertAdjacentText('beforeend', value);

document.createTextNode(value);

input.value  =  value;

element.className  =  safeClassName;

element.setAttribute('id', safeId); // only with hardcoded safe attribute names

```

  

If HTML is genuinely required, sanitize it first:

  

```js

const  clean  =  DOMPurify.sanitize(dirtyHtml);

element.innerHTML  =  clean;

```

  

Important: do not sanitize and then later concatenate or modify the sanitized HTML in unsafe ways.

  

---

  

##  `postMessage` XSS checks

  

`postMessage` is common in widgets, SSO flows, embedded tools, analytics scripts, and iframes.

  

Look for code like this:

  

```js

window.addEventListener('message', function(event) {

document.getElementById('output').innerHTML  =  event.data;

});

```

  

Problems to check:

  

- No `event.origin` validation.

- Origin validation uses weak checks like `includes()` or `endsWith()` incorrectly.

- No schema/type validation of `event.data`.

- Message data is passed to `innerHTML`, `eval`, `location`, `script.src`, or iframe `srcdoc`.

- Trusted origin is stored and later reused to load scripts or build URLs.

  

Safer pattern:

  

```js

const  allowedOrigins  =  new  Set(['https://trusted.example']);

  

window.addEventListener('message', (event) => {

if (!allowedOrigins.has(event.origin)) return;

if (typeof  event.data  !==  'object') return;

if (event.data.type  !==  'set-title') return;

  

document.querySelector('#title').textContent  =  event.data.title;

});

```

  

---

  

## Blind XSS

  

Blind XSS is usually stored XSS that runs in a place you cannot directly observe, such as:

  

- Admin panels.

- Support ticket systems.

- CRM systems.

- Log viewers.

- SIEM dashboards.

- Email preview tools.

- Report generators.

- File import review screens.

  

Safe blind XSS testing approach:

  

1. Use a unique payload ID per input field.

2. Use a callback domain controlled by you or by an approved tool.

3. Capture only minimum proof: timestamp, URL, user agent, page title if allowed.

4. Do not capture cookies, tokens, credentials, page body, or keystrokes unless explicitly authorized and necessary.

5. Correlate the callback with the submitted field.

6. Report where it was submitted and where it executed, if known.

  

Example harmless callback idea:

  

```html

<img  src="https://your-callback.example/xss?id=contact-name-001">

```

  

This proves that HTML injection rendered, but it does not prove JavaScript execution. To prove JavaScript execution in an authorized lab, use a callback that only sends a non-sensitive marker.

  

---

  

## Filter and WAF bypass notes

  

The best XSS testing comes from understanding the context. WAF bypass lists are secondary.

  

Common bypass ideas in authorized testing:

  

- Use a different tag: `<img>`, `<svg>`, `<iframe>`, `<video>`, `<audio>`.

- Use a different event: `onerror`, `onload`, `onfocus`, `onanimationstart`.

- Use mixed case if filtering is case-sensitive.

- Use HTML entities in HTML/attribute contexts.

- Use URL encoding in URL contexts.

- Use JavaScript escapes in JS string contexts.

- Try backticks where parentheses are filtered, for example: `` alert`1` ``.

- Test whether filtering removes only the first occurrence.

- Test whether the application decodes input more than once.

- Test Unicode normalization issues if the stack normalizes after filtering.

  

Small character reference table:

  


| Character | HTML entity | Decimal | URL encoded | JavaScript escape |
| --- | --- | --- | --- | --- |
| `<` | `&lt;` | `&#60;` | `%3C` | `\u003c` |
| `>` | `&gt;` | `&#62;` | `%3E` | `\u003e` |
| `"` | `&quot;` | `&#34;` | `%22` | `\u0022` |
| `'` | `&#x27;` | `&#39;` | `%27` | `\u0027` |
| `/` | `&#x2F;` | `&#47;` | `%2F` | `\u002f` |
| `=` | `&#x3D;` | `&#61;` | `%3D` | `\u003d` |
| `&` | `&amp;` | `&#38;` | `%26` | `\u0026` |

  

Do not rely on blacklist filtering. It is usually bypassable and often breaks legitimate input.

  

---

  

## XSS in file upload, SVG, Markdown, and generated reports

  

### Uploaded HTML/SVG

  

SVG is XML and can contain scriptable content depending on how it is served and embedded.

  

Check:

  

- Can users upload `.svg`, `.html`, `.xml`, `.mht`, or similar active content?

- Is uploaded content served from the main application origin?

- Is the response `Content-Type` correct?

- Is `Content-Disposition: attachment` used for untrusted active files?

- Are uploaded files served from a separate static/download domain with no application cookies?

  

Safer design:

  

- Store untrusted uploads on a separate origin.

- Use strict content types.

- Add `X-Content-Type-Options: nosniff`.

- Force download for risky file types.

- Strip or rasterize SVGs if they must be displayed.

  

### Markdown and WYSIWYG editors

  

Common mistakes:

  

- Raw HTML enabled by default.

-  `javascript:` links allowed.

- Sanitizer applied before Markdown rendering instead of after.

- Sanitizer output later modified with unsafe DOM APIs.

- Old sanitizer version.

  

### Generated reports

  

Stored XSS often appears in reports generated from imported files:

  

- XML/JSON/CSV metadata.

- Scan results.

- Asset names.

- Hostnames.

- User display names.

- PDF/HTML reports.

  

If a template uses an equivalent of `safe`, `raw`, or unescaped output for imported values, treat every imported field as a potential stored XSS source.

  

---

  

## XSS and CSRF

  

XSS can often bypass CSRF protection because injected JavaScript runs inside the trusted origin.

  

With XSS, JavaScript may be able to:

  

- Read CSRF tokens from forms or meta tags.

- Send same-origin requests with the victim's cookies.

- Call internal APIs available to the page.

  

CSRF tokens are still important, but they are not a complete defense against XSS.

  

Good additional controls:

  

- Re-authentication for sensitive actions.

- Step-up MFA for critical changes.

- Server-side authorization checks.

- Transaction signing or confirmation for high-risk operations.

- Audit logging and anomaly detection.

  

---

  
## Practical checklist

  

### Discovery

  

- [ ]  Crawled application manually and automatically.
- [ ]  Tested query parameters.
- [ ]  Tested path parameters. 
- [ ]  Tested POST/form/JSON fields.
- [ ]  Tested file names and metadata. 
- [ ]  Tested profile/comment/ticket fields.
- [ ]  Tested admin/backend rendering if in scope.
- [ ]  Tested headers that may be logged or reflected.
- [ ]  Tested Markdown/WYSIWYG fields.
- [ ]  Tested uploaded SVG/HTML behavior.
- [ ]  Tested client-side route/hash inputs.
- [ ]  Reviewed JavaScript for DOM sources and sinks.
- [ ]  Reviewed `postMessage` handlers.

  

### Context analysis

  

- [ ] Located canary in raw response.
- [ ] Located canary in live DOM.
- [ ] Identified HTML/attribute/URL/JS/CSS/comment context.
- [ ] Tested quote and angle bracket handling.
- [ ] Tested encoding/decoding behavior.
- [ ] Tested whether stored value appears in other views.

  

### Exploit validation

  

- [ ] Used harmless proof of execution.
- [ ] Confirmed affected origin.
- [ ] Confirmed victim role required.
- [ ] Confirmed whether interaction is required.
- [ ] Checked CSP behavior.
- [ ] Checked token/cookie exposure without collecting secrets.
- [ ] Confirmed whether same-origin requests are possible on a test account.

  
  

---

  

## Tools and labs

  

Use tools to assist, not to replace manual context analysis.

  

Useful practice/lab resources:

  

- PortSwigger Web Security Academy XSS labs: https://portswigger.net/web-security/cross-site-scripting

- PortSwigger XSS cheat sheet: https://portswigger.net/web-security/cross-site-scripting/cheat-sheet

- xssy: https://xssy.uk/

- PayloadsAllTheThings XSS: https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection

  

Useful testing tools:

  

- Burp Suite DOM Invader for DOM XSS analysis.

- Burp Collaborator or an approved internal callback service for blind XSS.

- XSStrike for assisted discovery: https://github.com/s0md3v/XSStrike

-  `wafw00f` for WAF fingerprinting: https://github.com/EnableSecurity/wafw00f

  

Always verify findings manually and keep payloads safe for the agreed scope.

  

---

  

## Reference links

 

- HackTricks XSS: https://hacktricks.wiki/en/pentesting-web/xss-cross-site-scripting/index.html

- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

- OWASP CSP Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html

- PortSwigger XSS: https://portswigger.net/web-security/cross-site-scripting

- PortSwigger XSS contexts: https://portswigger.net/web-security/cross-site-scripting/contexts

- PortSwigger DOM XSS: https://portswigger.net/web-security/cross-site-scripting/dom-based
