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

- Query data with object queries or predicate functions
- Read one or many records by field values
- Upsert with `save` using a `keyField`
- Update records that match a query
- Remove records that match a query
- Use a TypeORM-style repository mock adapter in tests
- Reuse state across tests with `seed` and `reset`
- Return cloned data to prevent accidental mutation leaks back into the store

## Additional Documentation

- [TypeORM-style Repository Mock](docs/typeorm-mock-repository.md)

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

## TypeORM-style Repository Mock

See the dedicated guide at [docs/typeorm-mock-repository.md](docs/typeorm-mock-repository.md) for:

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

- Object queries use exact-match comparison per field
- Function queries are better suited for more complex conditions
- Data returned by the library is always cloned to prevent test side effects
- `save` throws an error if `keyField` is configured but the record does not contain that field
