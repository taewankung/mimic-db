# TypeORM-style Repository Mock

`createTypeOrmRepositoryMock(store, options)` is an adapter that makes it easier to use `MimicDB` as a TypeORM-style repository in service tests while keeping state and behavior in the same store.

## Quick Start

```ts
import { MimicDB, createTypeOrmRepositoryMock } from "mimicdatabox";

interface UserRecord {
  id: number;
  email: string;
  status: "active" | "inactive";
  profile: {
    nickname: string;
  };
}

const store = new MimicDB<UserRecord>({
  keyField: "id",
  initialData: [
    {
      id: 1,
      email: "alice@example.com",
      status: "active",
      profile: { nickname: "alice" },
    },
  ],
});

const repository = createTypeOrmRepositoryMock(store);

const alice = await repository.findOne({
  where: { profile: { nickname: "alice" } },
});

await repository.save({
  id: 1,
  email: "alice@example.com",
  status: "inactive",
  profile: { nickname: "alice" },
});

await repository.update({ id: 1 }, { status: "active" });
await repository.delete({ id: 1 });
```

## Relations and Entity Transformation

If you need to attach relations or transform the entity shape before returning it, pass `hydrate(record, context)` through the options of `createTypeOrmRepositoryMock()`. For example, you can use `context.relations` to mimic opt-in relation loading.

## Array Input Support

Array input is supported for both `save()` and `remove()`, so you can seed or update multiple records directly in test setup.

```ts
await repository.save([
  {
    id: 2,
    email: "bob@example.com",
    status: "active",
    profile: { nickname: "bob" },
  },
  {
    id: 3,
    email: "charlie@example.com",
    status: "active",
    profile: { nickname: "charlie" },
  },
]);

const activeUsers = await repository.findBy({ status: "active" });
await repository.remove(activeUsers);
```

## NestJS Service Test Example

```ts
import { Test } from "@nestjs/testing";
import { InjectRepository, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { MimicDB, createTypeOrmRepositoryMock } from "mimicdatabox";

class RoleEntity {
  id!: number;
  name!: string;
}

class UserEntity {
  id!: number;
  email!: string;
  status!: "active" | "inactive";
  roleId!: number;
  role?: RoleEntity;
}

class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async findActiveUser(email: string) {
    return this.usersRepository.findOne({
      where: { email, status: "active" },
      relations: ["role"],
    });
  }
}

const rolesById = new Map<number, RoleEntity>([[1, { id: 1, name: "admin" }]]);

test("UsersService returns hydrated active user", async () => {
  const usersStore = new MimicDB<UserEntity>({
    keyField: "id",
    initialData: [
      {
        id: 1,
        email: "alice@example.com",
        status: "active",
        roleId: 1,
      },
    ],
  });

  const usersRepository = createTypeOrmRepositoryMock(usersStore, {
    hydrate(record, context) {
      const requestedRelations = Array.isArray(context.relations)
        ? context.relations
        : [];

      if (!requestedRelations.includes("role")) {
        return record;
      }

      return {
        ...record,
        role: rolesById.get(record.roleId),
      };
    },
  });

  const moduleRef = await Test.createTestingModule({
    providers: [
      UsersService,
      {
        provide: getRepositoryToken(UserEntity),
        useValue: usersRepository,
      },
    ],
  }).compile();

  const service = moduleRef.get(UsersService);
  const user = await service.findActiveUser("alice@example.com");

  expect(user?.role?.name).toBe("admin");
});
```

This pattern lets tests that use `@InjectRepository()` switch to MimicDB without hand-writing one mock method at a time, while still keeping query, read, and write behavior in a single store.

## API Summary

- `create(entityLike)` creates an entity shape without persisting it to the store
- `find(options?)` finds multiple records using TypeORM-style options
- `findBy(where)` finds multiple records directly from a where object
- `findOne(options)` returns the first matching record, or `null`
- `findOneBy(where)` returns the first matching record from a where object
- `count(options?)` counts matching records
- `save(entity | entity[])` upserts data using `MimicDB.save()`
- `update(criteria, partialEntity)` updates records and returns `{ affected, records }`
- `remove(entity | entity[])` removes by entity/key and returns the removed entities
- `delete(criteria)` removes by criteria and returns `{ affected }`
