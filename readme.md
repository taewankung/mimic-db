## MimicDB

```text
 __  __ _       _      ____  ____
|  \/  (_)_ __ (_) ___|  _ \| __ )
| |\/| | | '_ \| |/ __| | | |  _ \
| |  | | | | | | | (__| |_| | |_) |
|_|  |_|_|_| |_|_|\___|____/|____/
```

```text
             _.-========-._
         .-='  .-"""""-.   '=-.
       .'      /  .--.  \      '.
      /_______|  (o)(o)  |_______\
      |  _  _ |    __    | _  _  |
      | | || || .-'  '-. || || | |
      | |_||_||/  .--.  \||_||_| |
      |  __  | | (vvvv) | |  __  |
      | |  | |  \ '--' /  | |  | |
      | |__| |___'----'___| |__| |
      |______ / / /||\ \ \ ______|
     /______ /_/ /_||_\ \_\______\
```

MimicDB is a TypeScript library for managing in-memory mock data with a small database-like API for tests. It focuses on common unit test and integration test workflows such as field-based lookup, upsert, bulk updates, state reset, and controlling the initial dataset for each test run.

## Core Features

- Query data with exact match, query operators, or predicate functions
- Read one or many records by field values
- Upsert with `save` using a `keyField`
- Update records that match a query
- Remove records that match a query
- Use a TypeORM-style repository mock adapter in tests
- Reuse state across tests with `seed` and `reset`
- Return cloned data to prevent accidental mutation leaks back into the store

## Additional Documentation

- [TypeORM-style Repository Mock](docs/typeorm-mock-repository.md)
- [GitHub Repository](https://github.com/taewankung/mimic-db)

## Installation

```bash
npm install mimicdatabox
```

## Available Commands

```bash
npm run build
npm test
```

## Usage Example

```ts
import { MimicDB } from "mimicdatabox";

interface UserRecord {
  id: number;
  email: string;
  status: "active" | "inactive";
}

const users = new MimicDB<UserRecord>({
  keyField: "id",
  initialData: [
    { id: 1, email: "alice@example.com", status: "active" },
    { id: 2, email: "bob@example.com", status: "inactive" },
  ],
});

const activeUsers = users.find({ status: "active" });
const alice = users.findOne({ email: "alice@example.com" });

users.save({ id: 2, email: "bob@example.com", status: "active" });
users.update({ status: "active" }, { status: "inactive" });
users.reset();
```

## Query Operators

Use operator objects when a field needs more than an exact match, and use root-level `and` / `or` arrays when you want nested logical composition.

```ts
const matchedUsers = users.find({
  status: { in: ["active", "pending"] },
  email: { not: { contains: "@internal.local" } },
  and: [
    { age: { gte: 18 } },
    {
      or: [{ tags: { contains: "vip" } }, { email: { startsWith: "admin" } }],
    },
  ],
});
```

Supported field operators in v1:

- `in`
- `not`
- `contains`
- `startsWith`
- `gt`
- `gte`
- `lt`
- `lte`

Behavior notes:

- exact match remains the default when a field value is not an operator object
- multiple operators on the same field are combined with `and`
- `contains` supports substring matching for strings and exact element lookup for arrays
- `gt`, `gte`, `lt`, and `lte` support `number`, `string`, `bigint`, and `Date`
- missing fields, `null`, `undefined`, and type mismatches do not match comparison or string operators
- v1 operator queries target top-level fields; if you need deep object traversal, keep using a predicate function or the TypeORM-style repository mock `where` support

## TypeORM-style Repository Mock

See the dedicated guide at [typeorm-mock-repository.md](https://github.com/taewankung/mimic-db/blob/main/docs/typeorm-mock-repository.md) for:

- a quick start for `createTypeOrmRepositoryMock(store, options)`
- relation hydration and array input examples for `save()` / `remove()`
- a NestJS service test example with `getRepositoryToken()` and `@InjectRepository()`
- an adapter API summary

## Main API

### `new MimicDB<T>(options)`

- `initialData`: the initial dataset for the store
- `keyField`: the field used by `save` for upsert behavior, such as `id`

### Methods

- `count()` returns the total number of records
- `getAll()` returns all records
- `find(query?)` returns all records that match the query
- `findOne(query)` returns the first record that matches the query
- `save(record)` inserts or updates a record using `keyField`
- `update(query, update)` updates every record that matches the query
- `remove(query)` removes matching records and returns the number removed
- `seed(data)` replaces both the seed data and the current data
- `reset()` restores the latest seeded state
- `createTypeOrmRepositoryMock(store, options)` creates a TypeORM-style repository mock for service tests

## Project Structure

```text
.
|-- package.json
|-- tsconfig.json
|-- tsconfig.build.json
|-- tsconfig.test.json
|-- docs/
|   `-- typeorm-mock-repository.md
|-- src/
|   |-- MimicDB.ts
|   |-- index.ts
|   `-- typeorm-mock-repository/
|       |-- createTypeOrmRepositoryMock.ts
|       `-- index.ts
|-- test/
|   |-- MimicDB.test.ts
|   `-- typeorm-mock-repository/
|       `-- createTypeOrmRepositoryMock.test.ts
`-- readme.md
```

## Design Notes

- Object queries support exact-match by default and operator objects for top-level fields
- Function queries are better suited for more complex conditions
- Data returned by the library is always cloned to prevent test side effects
- `save` throws an error if `keyField` is configured but the record does not contain that field
