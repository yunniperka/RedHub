
# SQL Injection

  

## Introduction

  

SQL injection is a vulnerability where user-controlled input becomes part of a database query in an unsafe way.

  

If the application builds SQL like this:

  

```sql

SELECT * FROM users WHERE username =  '$username';

```

  

and `$username` is taken directly from a request, an attacker may be able to change the meaning of the query.

  

SQLi can lead to:

  

- reading data that should not be visible

- bypassing authentication or authorization logic

- modifying or deleting database records

- discovering database structure

- in some cases, reading files, writing files, or reaching operating-system level impact

  

Use these notes only for authorized testing, labs, CTFs, bug bounty scopes, or internal security work.

  

---

  

## Useful Resources

  

- [PortSwigger SQL Injection](https://portswigger.net/web-security/sql-injection)

- [PortSwigger SQL Injection Cheat Sheet](https://portswigger.net/web-security/sql-injection/cheat-sheet)

- [HackTricks SQL Injection](https://hacktricks.wiki/en/pentesting-web/sql-injection/index.html)

- [Incendium SQL Injection Notes](https://notes.incendium.rocks/pentesting-notes/web/injection/sql-injection)

- [David Tancredi SQLi Notes](https://davidtancredi.gitbook.io/pentesting-notes/r3dcl1ff/webapp-pentest/sqli)

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

- [OWASP WSTG - Testing for SQL Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection)

- [PayloadsAllTheThings SQL Injection](https://swisskyrepo.github.io/PayloadsAllTheThings/SQL%20Injection/)

- [PayloadsAllTheThings NoSQL Injection](https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/NoSQL%20Injection/README.md)

- [sqlmap Usage Wiki](https://github.com/sqlmapproject/sqlmap/wiki/usage)

  

---

  

## Basic Mental Model

  

Most SQLi testing is about answering three questions:

  

1.  **Does my input reach a SQL query?**

2.  **Can I break out of the current SQL context?**

3.  **Can I safely prove impact without damaging data?**

  

A vulnerable query often has this shape:

  

```sql

SELECT * FROM products WHERE id = USER_INPUT;

```

  

or:

  

```sql

SELECT * FROM users WHERE username =  'USER_INPUT';

```

  

The exact payload depends on where your input lands:

  


| Context | Example | What matters |
| --- | --- | --- |
| String value | `WHERE name = 'INPUT'` | Can you close the quote? |
| Numeric value | `WHERE id = INPUT` | Can you add logic without quotes? |
| LIKE pattern | `WHERE name LIKE '%INPUT%'` | Can you break out of the pattern and string? |
| ORDER BY | `ORDER BY INPUT` | Can you control column number or expression? |
| LIMIT/OFFSET | `LIMIT INPUT` | Usually numeric-only but still worth testing. |
| IN clause | `WHERE id IN (INPUT)` | Can you close the list or inject another value? |
| JSON body | `{ "id": "INPUT" }` | Same SQL risks, different transport format. |
| Cookie/header | `Cookie: tracking=INPUT` | Often used in analytics queries and blind SQLi. |

  

---

  

## Main SQLi Types

  


| Type | Meaning | Typical signal |
| --- | --- | --- |
| In-band SQLi | Results come back in the same HTTP response. | Data or errors appear on the page. |
| UNION-based SQLi | Uses `UNION SELECT` to append attacker-controlled rows to the original result. | Injected values appear in the response. |
| Error-based SQLi | Database errors reveal query behavior or data. | SQL syntax errors, type conversion errors, verbose stack traces. |
| Boolean-based blind SQLi | Response changes based on true/false conditions. | Different page content, status code, redirect, JSON field, or length. |
| Time-based blind SQLi | Response time changes based on a condition. | Delayed response when condition is true. |
| Out-of-band SQLi | Database triggers DNS/HTTP interaction to an external listener. | Collaborator/OAST callback. |
| Second-order SQLi | Payload is stored first, then executed later in another function. | Trigger happens in profile views, exports, admin panels, jobs. |
| Stacked queries | Multiple SQL statements are sent in one injection. | Depends heavily on DBMS and driver support. |
| ORM/HQL injection | Unsafe dynamic query construction in an ORM query language. | Similar behavior to SQLi, but syntax may differ. |
| NoSQL injection | Injection into non-SQL database queries, such as MongoDB operators. | Auth bypass, altered filters, unexpected query matches. |
  

---

  

## Where to Test

  

Test every place where user-controlled input can reach backend logic.

  


| Location | Examples |
| --- | --- |
| URL query parameters | `?id=1`, `?search=test`, `?sort=name` |
| URL path parameters | `/users/123`, `/product/1` |
| POST form fields | login, search, profile, checkout |
| JSON body fields | API filters, GraphQL variables, REST payloads |
| Cookies | tracking IDs, session-adjacent analytics cookies |
| Headers | `User-Agent`, `Referer`, `X-Forwarded-For`, custom headers |
| Multipart fields | upload metadata, filenames, descriptions |
| Import files | CSV, XML, JSON, Excel imports |
| Stored profile fields | username, display name, address, bio |
| Admin-only views | support tickets, CRM entries, logs, audit panels |

  

---

  

## Safe Testing Workflow

  

1.  **Confirm scope and authorization.**

2.  **Capture a baseline request and response.**

3.  **Change only one parameter at a time.**

4.  **Use a unique marker first**, for example `sqli_probe_73921`.

5.  **Try syntax probes**, such as a single quote, double quote, or backtick.

6.  **Compare responses** by status code, length, visible text, timing, and redirects.

7.  **Test boolean differences** with true and false conditions.

8.  **If blind, test controlled time delays.**

9.  **Avoid destructive payloads**, especially on production systems.

10.  **Prove impact with minimal data**, not full database dumps.

  

---

  

## First Probe Payloads

  

Start with simple probes that are unlikely to modify data.

  

```text

'

"

`

')

")

`)

'))

"))

`))

```

  

Look for:

  

- SQL syntax errors

- different HTTP status codes

- different response lengths

- changed page content

- changed JSON values

- redirects

- delayed responses

- blocked/WAF responses

  

### Important warning about `OR 1=1`

  

Be careful with payloads such as:

  

```sql

OR  1=1

```

  

They can look harmless during testing, but the same input may be reused in an `UPDATE`, `DELETE`, reporting job, or background process.

  

Use paired true/false tests instead where possible:

  

```sql

' AND '1'='1

' AND '1'='2

```

  

or for numeric contexts:

  

```sql

1  AND  1=1

1  AND  1=2

```

  

---

  

## Boolean-Based Confirmation

  

Boolean testing checks whether the application behaves differently when the injected condition is true or false.

  


| Context | True test | False test |
| --- | --- | --- |
| String | `' AND '1'='1` | `' AND '1'='2` |
| Numeric | `1 AND 1=1` | `1 AND 1=2` |
| Commented string | `' AND '1'='1' -- ` | `' AND '1'='2' -- ` |
| Parenthesized | `') AND ('1'='1` | `') AND ('1'='2` |

  

Possible confirmation signals:

  

- product/listing appears vs disappears

- login succeeds vs fails

- JSON says `true` vs `false`

- response length changes consistently

- different error message

- different redirect path

  

---

  

## Comments by Database

  

Comments are used to ignore the rest of the original query after injection.

  


| Database | Comment syntax |
| --- | --- |
| MySQL | `-- `, `#`, `/* comment */` |
| PostgreSQL | `--`, `/* comment */` |
| Microsoft SQL Server | `--`, `/* comment */` |
| Oracle | `--` |
| SQLite | `--`, `/* comment */` |

  

For MySQL, `--` normally needs a space after it:

  

```sql

--

```

  

A common end-of-query marker is:

  

```sql

-- -

```

  

---

  

## SQL Contexts and Example Thinking

  

### String Context

  

Original query:

  

```sql

SELECT * FROM users WHERE username =  'INPUT';

```

  

Probe:

  

```sql

'

```

  

Possible safe confirmation:

  

```sql

' AND '1'='1

' AND '1'='2

```

  

### Numeric Context

  

Original query:

  

```sql

SELECT * FROM products WHERE id = INPUT;

```

  

Probe:

  

```sql

1'

```

  

Possible safe confirmation:

  

```sql

1  AND  1=1

1  AND  1=2

```

  

### ORDER BY Context

  

Original query:

  

```sql

SELECT * FROM products ORDER BY INPUT;

```

  

Useful tests:

  

```sql

1

2

3

```

  

If column indexes work, the response may reorder or error when the index is invalid.

  

### LIKE Context

  

Original query:

  

```sql

SELECT * FROM products WHERE  name  LIKE  '%INPUT%';

```

  

You may need to escape both the string and wildcard pattern context.

  

---

  

## Database Fingerprinting

  

Different databases have different functions and syntax.

  


| Task | MySQL | PostgreSQL | Microsoft SQL Server | Oracle | SQLite |
| --- | --- | --- | --- | --- | --- |
| Version | `SELECT @@version` | `SELECT version()` | `SELECT @@version` | `SELECT banner FROM v$version` | `SELECT sqlite_version()` |
| Current database | `SELECT database()` | `SELECT current_database()` | `SELECT DB_NAME()` | `SELECT ora_database_name FROM dual` | `PRAGMA database_list` |
| Current user | `SELECT user()` | `SELECT current_user` | `SELECT SYSTEM_USER` | `SELECT user FROM dual` | N/A |
| String concat | `CONCAT('a','b')` or `'a' 'b'` | `'a'||'b'` | `'a'+'b'` | `'a'||'b'` | `'a'||'b'` |
| Sleep | `SLEEP(5)` | `pg_sleep(5)` | `WAITFOR DELAY '0:0:5'` | `DBMS_LOCK.SLEEP(5)` | Usually no built-in sleep |
  

---

  

## UNION-Based SQLi

  

UNION-based SQLi is useful when the application returns query results in the HTTP response.

  

The `UNION` operator appends the result of another `SELECT` query to the original query.

  

### UNION Requirements

  

For `UNION SELECT` to work:

  

1. The number of selected columns must match.

2. The data types must be compatible.

3. At least one returned column must be visible in the response.

  

### Find the Number of Columns

  

Method 1: `ORDER BY`

  

```sql

ORDER BY  1

ORDER BY  2

ORDER BY  3

```

  

When the number is too high, the database may return an error.

  

Method 2: `UNION SELECT NULL`

  

```sql

UNION  SELECT  NULL

UNION  SELECT  NULL,NULL

UNION  SELECT  NULL,NULL,NULL

```

  

### Find a Visible Text Column

  

Use marker values:

  

```sql

UNION  SELECT  NULL,'sqli_probe_73921',NULL

```

  

If `sqli_probe_73921` appears in the response, that column is reflected.

  

### Minimal Data Proof

  

Use minimal, non-sensitive proof first:

  

```sql

UNION  SELECT  NULL,version(),NULL

```

  

or:

  

```sql

UNION  SELECT  NULL,current_user,NULL

```

  

Avoid dumping user tables unless the scope explicitly allows it.

  

---

  

## Error-Based SQLi

  

Error-based SQLi uses database errors to prove injection or leak information.

  

Signals include:

  

- SQL syntax errors

- type conversion errors

- stack traces

- database driver messages

- ORM exceptions

- column count errors

- unknown table or column errors

  

Useful testing idea:

  

```sql

'

```

  

Then compare with:

  

```sql

''

```

  

If a single quote breaks the query and two quotes repair it, that is a strong signal.

  

### Error Handling Note

  

Verbose database errors are useful for testers but dangerous in production. Applications should log detailed errors server-side and show generic errors to users.

  

---

  

## Blind SQLi

  

Blind SQLi exists when the query is injectable but results are not directly returned.

  

### Boolean-Based Blind SQLi

  

Example logic:

  

```sql

' AND SUBSTRING((SELECT version()),1,1)='8

```

  

If the response changes only when the condition is true, the vulnerability can be exploited one bit or character at a time.

  

Better for proof-of-risk:

  

```sql

' AND 'a'='a

' AND 'a'='b

```

  

### Time-Based Blind SQLi

  

Time-based SQLi uses a delay as the confirmation signal.

  


| Database | Example delay function |
| --- | --- |
| MySQL | `SLEEP(5)` |
| PostgreSQL | `pg_sleep(5)` |
| SQL Server | `WAITFOR DELAY '0:0:5'` |
| Oracle | `DBMS_LOCK.SLEEP(5)` |

  

Use short delays in real testing:

  

```text

3 to 5 seconds is usually enough

```

  

Avoid long delays and high concurrency because time-based testing can degrade service.

  

### Out-of-Band SQLi

  

Out-of-band SQLi uses DNS or HTTP callbacks to a controlled listener such as Burp Collaborator or another OAST service.

  

This is useful when:

  

- the application response never changes

- errors are hidden

- timing is unreliable

- the query runs asynchronously

  

Only use OAST endpoints that are approved by the engagement scope.

  

---

  

## Second-Order SQLi

  

Second-order SQLi happens when the application safely accepts input at one point, stores it, and later uses it unsafely in a different SQL query.

  

Common places:

  


| Stored input | Later trigger |
| --- | --- |
| Registration field | Profile page |
| Display name | Admin user management |
| Email address | Password reset or notification job |
| Support ticket | Agent/admin panel |
| Import row | Background processing job |
| Product field | Search index or report export |

  

Testing approach:

  

1. Put a unique marker or SQLi probe into a stored field.

2. Use the application normally.

3. Visit pages or functions that later process that field.

4. Check for errors, behavior changes, or delayed responses.

  

With sqlmap, second-order testing can use options such as:

  

```bash

sqlmap  -r  req.txt  --second-req  second_req.txt  --batch

```

  

---

  

## Stacked Queries

  

Stacked queries mean sending more than one SQL statement in the same injection point.

  

Example shape:

  

```sql

1; SELECT  version()

```

  

This depends on:

  

- database type

- database driver

- application framework

- database permissions

- whether multi-statements are enabled

  

Stacked queries can become destructive quickly. Do not test `INSERT`, `UPDATE`, `DELETE`, `DROP`, file write, or OS-level functions unless the rules of engagement explicitly allow it.

  

---

  

## SQL Injection Filter Evasion - Unicode Normalization

  

Unicode normalization can turn visually unusual characters into normal SQL syntax characters after some layer of the application processes them.

  

This can matter when:

  

- the frontend filters one representation

- the backend normalizes input later

- the WAF and application normalize differently

- the database receives a normalized dangerous character

  

Useful references:

  

- [AppCheck Unicode Normalization Vulnerabilities](https://appcheck-ng.com/unicode-normalization-vulnerabilities-the-special-k-polyglot/)

- [Unicode Normalization Table](https://appcheck-ng.com/wp-content/uploads/unicode_normalization.html)

- [0xacb Normalization Table](https://0xacb.com/normalization_table)

  
| Character | Unicode-normalized encoding example |
| --- | --- |
| `o` | `%e1%b4%bc` |
| `r` | `%e1%b4%bf` |
| `1` | `%c2%b9` |
| `=` | `%e2%81%bc` |
| `/` | `%ef%bc%8f` |
| `-` | `%ef%b9%a3` |
| `#` | `%ef%b9%9f` |
| `*` | `%ef%b9%a1` |
| `'` | `%ef%bc%87` |
| `"` | `%ef%bc%82` |
| `|` | `%ef%bd%9c` |

  

### Other Evasion Ideas

  


| Technique | Example idea |
| --- | --- |
| Case variation | `UnIoN SeLeCt` |
| Inline comments | `UN/**/ION SEL/**/ECT` |
| Whitespace changes | tabs, newlines, comments |
| URL encoding | `%27` for `'` |
| Double encoding | `%2527` becomes `%27`, then `'` |
| Alternative operators | `LIKE`, `REGEXP`, `BETWEEN` |
| String concatenation | build strings without writing them directly |
| DB-specific syntax | MySQL conditional comments, PostgreSQL casts, SQL Server functions |

  

Do not rely on bypass tricks before confirming the basic injection point. First understand the query context.

  

---

  

## SQLMap Basics

  

sqlmap automates SQLi detection and exploitation. It is powerful, so start with low-risk options and avoid destructive actions unless explicitly approved.

  


| Command | Description |
| --- | --- |
| `sqlmap -h` | View the basic help menu. |
| `sqlmap -hh` | View the advanced help menu. |
| `sqlmap -u "https://example.com/item?id=1" --batch` | Test a URL without interactive prompts. |
| `sqlmap -u "https://example.com/item?id=1" -p id --batch` | Test only the `id` parameter. |
| `sqlmap -r req.txt --batch` | Use a raw HTTP request from Burp/ZAP. |
| `sqlmap "https://example.com/" --data "uid=1&name=test" --batch` | Test a POST request. |
| `sqlmap "https://example.com/" --data "uid=1*&name=test" --batch` | Mark the injection point with `*`. |
| `sqlmap -u "https://example.com/?id=1" --cookie="SESSION=abc" --batch` | Include cookies. |
| `sqlmap -u "https://example.com/?id=1" --method PUT --data "id=1" --batch` | Test a PUT request. |
| `sqlmap -u "https://example.com/?id=1" --proxy "http://127.0.0.1:8080" --batch` | Proxy traffic through Burp/ZAP. |
| `sqlmap -u "https://example.com/?id=1" --dbms=mysql --batch` | Tell sqlmap the DBMS if already known. |
| `sqlmap -u "https://example.com/?id=1" --level=5 --risk=2 --batch` | Increase testing coverage. Use carefully. |
| `sqlmap -u "https://example.com/?id=1" --banner --current-user --current-db --is-dba --batch` | Basic DB info enumeration. |
| `sqlmap -u "https://example.com/?id=1" --tables -D appdb --batch` | Enumerate tables in one database. |
| `sqlmap -u "https://example.com/?id=1" --schema --batch` | Enumerate schema metadata. |
| `sqlmap -u "https://example.com/?id=1" --search -T user --batch` | Search for table names. |
| `sqlmap -r req.txt --csrf-token "csrf-token" --batch` | Handle anti-CSRF token refresh. |
| `sqlmap --list-tampers` | List tamper scripts. |
| `sqlmap -r req.txt --second-req second_req.txt --batch` | Test a second-order flow. |

  

### High-Impact sqlmap Options

  

Use only in labs or when explicitly authorized.

  


| Command | Why high impact |
| --- | --- |
| `sqlmap -u "https://example.com/?id=1" --dump -D appdb -T users --batch` | Extracts table data. |
| `sqlmap -u "https://example.com/?id=1" --passwords --batch` | Attempts password hash enumeration/cracking. |
| `sqlmap -u "https://example.com/?id=1" --file-read "/etc/passwd" --batch` | Attempts local file read through the DBMS. |
| `sqlmap -u "https://example.com/?id=1" --file-write "shell.php" --file-dest "/var/www/html/shell.php" --batch` | Attempts file write and can lead to code execution. |
| `sqlmap -u "https://example.com/?id=1" --os-shell` | Attempts operating-system command execution. |

### Practical sqlmap Tips

  

- Prefer `-r req.txt` for real applications because it preserves headers, cookies, JSON bodies, and method.

- Use `-p parameter_name` to avoid noisy testing of unrelated parameters.

- Use `--batch` only when you know the defaults are acceptable.

- Use `--level` and `--risk` gradually.

- Use `--delay`, `--timeout`, and `--retries` to avoid aggressive traffic.

- Do not use `--dump-all` in production tests.

- Save evidence with `-t traffic.txt` when you need an audit trail.

  

---

  

## Manual Testing Checklist

  
| Step | Question |
| --- | --- |
| Baseline | What does a normal response look like? |
| Reflection | Does the value appear in the response? |
| Error | Does a quote or special character cause an SQL error? |
| Repair | Does a second quote or comment repair the query? |
| Boolean | Do true and false conditions produce consistent differences? |
| Time | Can a short delay be triggered safely? |
| DBMS | Which database syntax works? |
| Scope | Is data extraction allowed? |
| Impact | What is the minimal proof that shows risk? |
| Cleanup | Did the test create accounts, logs, jobs, or stored payloads that need removal? |

  

---

  

---

## Practical SQLi Checklist

### Discovery

- [ ] Confirmed scope and authorization before testing.
- [ ] Captured a clean baseline request and response.
- [ ] Identified all candidate input locations: query parameters, path parameters, POST/form fields, JSON fields, cookies, headers, and file/import fields.
- [ ] Tested only one parameter at a time.
- [ ] Used a unique marker such as `sqli_probe_73921` before sending SQL syntax probes.
- [ ] Checked whether the marker appears in the response, error message, later page, admin view, export, report, or background job.

### Context identification

- [ ] Determined whether the input is used in a string, numeric, `LIKE`, `ORDER BY`, `LIMIT`, `IN`, JSON, cookie, or header context.
- [ ] Tested quote handling with `'`, `"`, and backtick where relevant.
- [ ] Tested whether comments such as `-- -`, `#`, or `/* */` affect the response.
- [ ] Compared true and false conditions, for example `' AND '1'='1` vs `' AND '1'='2`.
- [ ] Checked for consistent differences in status code, response length, page content, redirects, JSON values, and error messages.

### Error-based and boolean validation

- [ ] Checked for SQL syntax errors, stack traces, ORM errors, or database driver messages.
- [ ] Confirmed whether a broken query can be repaired with a second quote or comment.
- [ ] Used paired true/false tests instead of broad destructive conditions like `OR 1=1`.
- [ ] Verified the behavior at least twice to avoid false positives caused by caching, rate limits, or dynamic content.
- [ ] Checked whether the vulnerable input is reused in multiple backend queries.

### UNION-based validation

- [ ] Confirmed that query results are reflected in the HTTP response.
- [ ] Identified the number of columns using `ORDER BY` or `UNION SELECT NULL` tests.
- [ ] Identified which returned column is visible in the response.
- [ ] Used a harmless marker such as `sqli_probe_73921` to prove reflection.
- [ ] Used minimal proof such as database version or current user only when allowed.
- [ ] Avoided dumping sensitive tables unless explicitly authorized.

### Blind SQLi validation

- [ ] Tested boolean-based blind behavior with safe true/false conditions.
- [ ] Tested short time delays only when needed and authorized.
- [ ] Used short delays, usually 3 to 5 seconds, to reduce service impact.
- [ ] Accounted for normal latency, caching, and application noise.
- [ ] Considered OAST/DNS callbacks only if allowed by the engagement scope.
- [ ] Avoided high-concurrency time-based testing.

### Second-order SQLi

- [ ] Tested stored fields such as registration data, profile fields, display names, support tickets, imports, and product fields.
- [ ] Submitted unique payload IDs per field to track where execution happens later.
- [ ] Triggered later workflows that may reuse the stored value, such as profile views, admin panels, exports, emails, reports, and background jobs.
- [ ] Checked whether stored input appears in a different SQL context later.
- [ ] Cleaned up test accounts, stored payloads, and generated records after testing.

### SQLMap usage

- [ ] Used `-r req.txt` when possible to preserve method, headers, cookies, body, and CSRF tokens.
- [ ] Used `-p parameter` to limit testing to the intended parameter.
- [ ] Started with low-risk settings before increasing `--level` or `--risk`.
- [ ] Used rate limits, delays, timeouts, and retries when testing production-like systems.
- [ ] Avoided `--dump-all`, `--os-shell`, `--file-write`, and destructive options unless explicitly authorized.
- [ ] Manually verified important sqlmap findings.

### NoSQL injection

- [ ] Checked whether API fields expect strings but accept JSON objects or operators.
- [ ] Tested safe operator behavior such as `$ne`, `$gt`, `$regex`, and `$exists` only where appropriate.
- [ ] Checked for login bypass, changed record counts, different JSON responses, operator errors, or timing changes.
- [ ] Verified that authorization is enforced after querying, not only through user-controlled filters.
- [ ] Avoided expensive regex or server-side expression tests that could degrade service.

### Impact and reporting

- [ ] Identified the affected endpoint, method, parameter, role, and authentication requirement.
- [ ] Recorded baseline, true-condition, false-condition, error, timing, or OAST evidence.
- [ ] Proved impact with the minimum necessary data.
- [ ] Assessed whether the database user can read, modify, delete, write files, or execute OS-level actions.
- [ ] Documented business impact clearly.
- [ ] Recommended parameterized queries, allow-list validation for dynamic identifiers, least privilege, and generic user-facing errors.
- [ ] Listed cleanup actions for test data, accounts, stored payloads, and logs.


## NoSQL Injection

  

NoSQL injection is similar in concept: user input changes the meaning of a database query, but the query language is not SQL.

  

Common targets:

  

- MongoDB

- CouchDB

- Firebase/Firestore rules

- Elasticsearch queries

- GraphQL resolvers backed by NoSQL

- JSON-based API filters

  

### MongoDB-Style Example

  

Unsafe logic may look like this:

  

```javascript

db.users.findOne({

username: req.body.username,

password: req.body.password

})

```

  

If the application accepts objects instead of strings, an attacker might try to send operators instead of normal values.

  

Example test shape:

  

```json

{

"username": {

"$ne": null

},

"password": {

"$ne": null

}

}

```

  

Other common operators to understand:

  


| Operator | Meaning |
| --- | --- |
| `$ne` | Not equal |
| `$gt` | Greater than |
| `$lt` | Less than |
| `$regex` | Regular expression match |
| `$where` | JavaScript expression in older/unsafe MongoDB usage |
| `$exists` | Field exists |

  

### NoSQL Testing Signals

  


| Signal | Meaning |
| --- | --- |
| Login bypass | Query matched a user without the correct password. |
| More records returned | Filter logic was changed. |
| Error mentioning operators | Input reached the NoSQL query parser. |
| Timing change | Expensive regex or server-side expression may have executed. |
| Different JSON response | Query behavior changed. |

  
