import test from "node:test";
import assert from "node:assert/strict";

import { MimicDB, createTypeOrmRepositoryMock } from "../../src";

interface RoleRecord {
  id: number;
  name: string;
}

interface UserRecord {
  id: number;
  email: string;
  status: "active" | "inactive";
  roleId: number;
  profile: {
    nickname: string;
  };
  role?: RoleRecord;
}

const initialUsers: UserRecord[] = [
  {
    id: 1,
    email: "alice@example.com",
    status: "active",
    roleId: 101,
    profile: { nickname: "alice" },
  },
  {
    id: 2,
    email: "bob@example.com",
    status: "inactive",
    roleId: 102,
    profile: { nickname: "bob" },
  },
];

const rolesById = new Map<number, RoleRecord>([
  [101, { id: 101, name: "admin" }],
  [102, { id: 102, name: "viewer" }],
]);

test("createTypeOrmRepositoryMock supports TypeORM-style where options", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db);

  const user = await repository.findOne({
    where: { profile: { nickname: "alice" } },
  });
  const missing = await repository.findOne({
    where: { email: "missing@example.com" },
  });

  assert.equal(user?.id, 1);
  assert.equal(missing, null);
});

test("createTypeOrmRepositoryMock create does not persist and save upserts records", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db);

  const created = repository.create({
    id: 3,
    email: "charlie@example.com",
    status: "active",
    roleId: 102,
    profile: { nickname: "charlie" },
  });

  assert.equal(db.count(), 2);
  assert.equal((created as UserRecord).id, 3);

  const inserted = (await repository.save(created as UserRecord)) as UserRecord;
  const updated = (await repository.save({
    id: 2,
    email: "bob@example.com",
    status: "active",
    roleId: 102,
    profile: { nickname: "builder" },
  })) as UserRecord;

  assert.equal(inserted.id, 3);
  assert.equal(updated.profile.nickname, "builder");
  assert.equal(db.count(), 3);
});

test("createTypeOrmRepositoryMock save accepts array input", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db);

  const saved = (await repository.save([
    {
      id: 2,
      email: "bob@example.com",
      status: "active",
      roleId: 102,
      profile: { nickname: "builder" },
    },
    {
      id: 3,
      email: "charlie@example.com",
      status: "active",
      roleId: 102,
      profile: { nickname: "charlie" },
    },
  ])) as UserRecord[];

  assert.equal(saved.length, 2);
  assert.equal(saved[0]?.profile.nickname, "builder");
  assert.equal(saved[1]?.id, 3);
  assert.equal(db.count(), 3);
  assert.equal(db.findOne({ id: 2 })?.status, "active");
  assert.equal(db.findOne({ id: 3 })?.email, "charlie@example.com");
});

test("createTypeOrmRepositoryMock supports find, count, update, delete, and remove", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db);

  const inactiveUsers = await repository.find({
    where: { status: "inactive" },
  });
  const inactiveCount = await repository.count({
    where: { status: "inactive" },
  });
  const updateResult = await repository.update(
    { status: "inactive" },
    { status: "active" },
  );
  const deleteResult = await repository.delete({ email: "bob@example.com" });
  const alice = await repository.findOneBy({ id: 1 });
  const removed = await repository.remove(alice!);

  assert.equal(inactiveUsers.length, 1);
  assert.equal(inactiveCount, 1);
  assert.equal(updateResult.affected, 1);
  assert.equal(updateResult.records[0]?.status, "active");
  assert.equal(deleteResult.affected, 1);
  assert.equal((removed as UserRecord).id, 1);
  assert.equal(db.count(), 0);
});

test("createTypeOrmRepositoryMock can hydrate relations through options", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db, {
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

  const plainUser = await repository.findOne({ where: { id: 1 } });
  const hydratedUser = await repository.findOne({
    where: { id: 1 },
    relations: ["role"],
  });

  assert.equal(plainUser?.role, undefined);
  assert.deepEqual(hydratedUser?.role, { id: 101, name: "admin" });
});

test("createTypeOrmRepositoryMock remove accepts array input", async () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });
  const repository = createTypeOrmRepositoryMock(db);

  const removableUsers = (await repository.save([
    {
      id: 3,
      email: "charlie@example.com",
      status: "active",
      roleId: 102,
      profile: { nickname: "charlie" },
    },
  ])) as UserRecord[];
  const alice = (await repository.findOneBy({ id: 1 })) as UserRecord;
  const removed = (await repository.remove([
    alice,
    removableUsers[0]!,
  ])) as UserRecord[];

  assert.deepEqual(
    removed.map((record) => record.id),
    [1, 3],
  );
  assert.equal(db.count(), 1);
  assert.equal(db.findOne({ id: 1 }), undefined);
  assert.equal(db.findOne({ id: 3 }), undefined);
});
