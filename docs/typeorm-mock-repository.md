# TypeORM-style Repository Mock

`createTypeOrmRepositoryMock(store, options)` เป็น adapter สำหรับทำให้ `MimicDB` ใช้แทน repository แนว TypeORM ได้ง่ายขึ้นใน service test โดยยังเก็บ state และ behavior ไว้ใน store เดียวกัน

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

ถ้าต้องการแนบ relation หรือแปลง shape ของ entity ก่อนคืนค่า สามารถส่ง `hydrate(record, context)` ผ่าน options ของ `createTypeOrmRepositoryMock()` ได้ เช่นใช้ `context.relations` เพื่อเลียนแบบการโหลด relation แบบ opt-in

## Array Input Support

รองรับ array input สำหรับ `save()` และ `remove()` ด้วย จึงใช้ seed/update state หลาย record ใน test setup ได้ตรง ๆ

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

รูปแบบนี้ช่วยให้ test ที่ใช้ `@InjectRepository()` เปลี่ยนมาใช้ MimicDB ได้โดยไม่ต้องเขียน method mock ทีละตัว และยังเก็บ behavior ของ query/read/write ไว้ใน store เดียวกัน

## API Summary

- `create(entityLike)` สร้าง entity shape โดยไม่ persist ลง store
- `find(options?)` ค้นหาหลาย record ด้วย TypeORM-style options
- `findBy(where)` ค้นหาหลาย record ด้วย where object โดยตรง
- `findOne(options)` คืน record แรกที่ตรงเงื่อนไข หรือ `null`
- `findOneBy(where)` คืน record แรกจาก where object โดยตรง
- `count(options?)` นับจำนวน record ที่ตรงเงื่อนไข
- `save(entity | entity[])` upsert ข้อมูลด้วย `MimicDB.save()`
- `update(criteria, partialEntity)` อัปเดตและคืน `{ affected, records }`
- `remove(entity | entity[])` ลบตาม entity/key และคืน entity ที่ถูกลบ
- `delete(criteria)` ลบตามเงื่อนไขและคืน `{ affected }`
