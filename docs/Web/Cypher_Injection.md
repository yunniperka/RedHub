# Cypher Injection

## Introduction

Cypher Injection is an injection vulnerability where user-controlled input is inserted into a **Cypher query** in an unsafe way.

Cypher is the query language commonly associated with Neo4j and graph databases. It is used to query graph structures made of:

* nodes
* relationships
* labels
* relationship types
* properties
* paths

The key idea:

```text id="x3o1ft"
User input  →  application builds Cypher query  →  graph database executes attacker-controlled logic
```

This is dangerous because the attacker may be able to alter the query structure, bypass access controls, enumerate graph metadata, extract data, trigger outbound requests, modify graph data, or abuse database procedures.

Cypher injection can lead to:

* authentication bypass
* authorization bypass
* graph data disclosure
* user/account enumeration
* label and relationship type enumeration
* property/key enumeration
* sensitive node disclosure
* blind data extraction
* out-of-band data exfiltration using `LOAD CSV`
* write operations such as `CREATE`, `SET`, `MERGE`, `DELETE`, or `DETACH DELETE`
* procedure abuse through `CALL`
* APOC procedure abuse if installed and exposed
* SSRF-like behavior through remote URL loading
* denial of service through expensive graph traversal
* full application compromise if secrets or credentials are stored in the graph

---

## Useful Resources

* [Incendium Cypher Injection Notes](https://notes.incendium.rocks/pentesting-notes/web/injection/cypher-injection)
* [Neo4j — Protecting against Cypher Injection](https://neo4j.com/developer/kb/protecting-against-cypher-injection/)
* [Neo4j Cypher Manual — Parameters](https://neo4j.com/docs/cypher-manual/current/syntax/parameters/)
* [Neo4j HTTP API — Query Parameters](https://neo4j.com/docs/http-api/current/query/)
* [Pentester.land Cypher Injection Cheat Sheet](https://pentester.land/blog/cypher-injection-cheatsheet/)
* [HackTricks Cypher Injection Neo4j](https://github.com/b4rdia/HackTricks/blob/master/pentesting-web/sql-injection/cypher-injection-neo4j.md)
* [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings)
* [Neo4j Cypher Cheat Sheet](https://neo4j.com/docs/cypher-cheat-sheet/current/)
* [Neo4j APOC Documentation](https://neo4j.com/docs/apoc/current/)
* [Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)

---

## Basics

Most Cypher injection testing is about answering eight questions:

1. **Is the application backed by Neo4j or another Cypher-like graph database?**
   Look for graph search, recommendations, relationships, permissions, fraud graphs, asset graphs, BloodHound-style data, knowledge graphs, or Neo4j error messages.

2. **Is user input inserted into a Cypher query?**
   Example: username, search term, label, relationship type, property name, node ID, filter value, sort field, graph traversal depth.

3. **Which Cypher context receives the input?**
   Example: string literal, numeric literal, label, relationship type, property key, map value, regular expression, `WHERE` clause, `ORDER BY`, `RETURN`, procedure argument.

4. **Can I break out of the current context?**
   Example: terminate a string with `'`, close a map with `}`, close a node pattern with `)`, add `WITH`, `UNION`, `CALL`, or comment the rest with `//`.

5. **Can I see the query result?**
   If yes, it is in-band Cypher injection.

6. **If I cannot see output, can I prove execution indirectly?**
   Use boolean logic, error differences, time/expensive queries, or controlled OAST callbacks through safe lab-only `LOAD CSV` patterns.

7. **Can the query be used to read graph metadata?**
   Example: labels, relationship types, property keys, database version.

8. **Can the query write or delete data?**
   Avoid destructive testing unless explicitly authorized.

A vulnerable flow often looks like this:

```text id="v6ltqa"
User submits:
    alice

Application builds:
    MATCH (u:User {username: 'alice'}) RETURN u

Attacker submits:
    alice' OR 1=1 //

Application builds:
    MATCH (u:User {username: 'alice' OR 1=1 //'}) RETURN u
```

The attacker has altered the query logic.

A safer flow should look like this:

```cypher id="plz4ak"
MATCH (u:User {username: $username}) RETURN u
```

With parameters:

```json id="jj04ri"
{
  "username": "alice"
}
```

Key rule:

```text id="ox18z2"
User input should be data, not Cypher query structure.
```

---

## Graph Database Terminology

| Term              | Meaning                                   | Example                    |
| ----------------- | ----------------------------------------- | -------------------------- |
| Node              | Entity in the graph                       | `(u)`                      |
| Label             | Type/category of a node                   | `(u:User)`                 |
| Relationship      | Edge between nodes                        | `(u)-[r]->(p)`             |
| Relationship type | Type/category of relationship             | `[:FOLLOWS]`               |
| Property          | Key/value data on node or relationship    | `{username: 'alice'}`      |
| Path              | Connected sequence of nodes/relationships | `(a)-[*1..3]->(b)`         |
| Clause            | Query component                           | `MATCH`, `WHERE`, `RETURN` |
| Procedure         | Callable database routine                 | `CALL db.labels()`         |

Basic Cypher examples:

```cypher id="io71u3"
MATCH (u:User) RETURN u LIMIT 10
```

```cypher id="bn9mtg"
MATCH (u:User {username: 'alice'}) RETURN u
```

```cypher id="b3m5u8"
MATCH (u:User)-[:MEMBER_OF]->(g:Group)
WHERE g.name = 'admin'
RETURN u.username
```

---

## Cypher Injection vs SQL Injection

| Area               | SQL Injection         | Cypher Injection                 |
| ------------------ | --------------------- | -------------------------------- |
| Database model     | Tables, rows, columns | Nodes, relationships, properties |
| Common read clause | `SELECT`              | `MATCH ...                       |
