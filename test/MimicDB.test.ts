import test from "node:test";
import assert from "node:assert/strict";

import { MimicDB, type MimicDBQuery } from "../src";

interface UserRecord {
  id: number;
  email: string;
  status: "active" | "inactive";
  profile: {
    nickname: string;
  };
}

const initialUsers: UserRecord[] = [
  {
    id: 1,
    email: "alice@example.com",
    status: "active",
    profile: { nickname: "alice" },
  },
  {
    id: 2,
    email: "bob@example.com",
    status: "inactive",
    profile: { nickname: "bob" },
  },
];

test("find returns records matched by object query", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  const result = db.find({ status: "active", email: "alice@example.com" });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 1);
});

test("save updates an existing record when keyField matches", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  db.save({
    id: 2,
    email: "bob@example.com",
    status: "active",
    profile: { nickname: "builder" },
  });

  const record = db.findOne({ id: 2 });

  assert.deepEqual(record, {
    id: 2,
    email: "bob@example.com",
    status: "active",
    profile: { nickname: "builder" },
  });
  assert.equal(db.count(), 2);
});

test("save inserts a new record when keyField does not exist yet", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  db.save({
    id: 3,
    email: "charlie@example.com",
    status: "active",
    profile: { nickname: "charlie" },
  });

  assert.equal(db.count(), 3);
  assert.equal(db.findOne({ id: 3 })?.email, "charlie@example.com");
});

test("update patches every matched record", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  const updated = db.update({ status: "inactive" }, { status: "active" });

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.status, "active");
  assert.equal(db.find({ status: "active" }).length, 2);
});

test("remove deletes matched records", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  const removed = db.remove((record) => record.status === "inactive");

  assert.equal(removed, 1);
  assert.equal(db.count(), 1);
  assert.equal(db.findOne({ id: 2 }), undefined);
});

test("reset restores the original seed data", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  db.remove({ id: 1 });
  db.save({
    id: 3,
    email: "charlie@example.com",
    status: "active",
    profile: { nickname: "charlie" },
  });
  db.reset();

  assert.equal(db.count(), 2);
  assert.equal(db.findOne({ id: 1 })?.email, "alice@example.com");
  assert.equal(db.findOne({ id: 3 }), undefined);
});

test("returned data is cloned to avoid accidental mutation leaks", () => {
  const db = new MimicDB<UserRecord>({
    initialData: initialUsers,
    keyField: "id",
  });

  const record = db.findOne({ id: 1 });

  assert.ok(record);
  record.profile.nickname = "changed-outside";

  assert.equal(db.findOne({ id: 1 })?.profile.nickname, "alice");
});

interface OperatorUserRecord {
  id: number;
  email: string;
  status: "active" | "inactive" | "pending";
  age: number;
  tags: string[];
  nickname?: string | null;
  lastLogin: Date;
}

const operatorUsers: OperatorUserRecord[] = [
  {
    id: 1,
    email: "alice@example.com",
    status: "active",
    age: 29,
    tags: ["vip", "team-red"],
    nickname: "ally",
    lastLogin: new Date("2024-01-10T00:00:00.000Z"),
  },
  {
    id: 2,
    email: "bob@example.com",
    status: "inactive",
    age: 41,
    tags: ["staff"],
    nickname: null,
    lastLogin: new Date("2024-02-15T00:00:00.000Z"),
  },
  {
    id: 3,
    email: "charlie@sample.com",
    status: "pending",
    age: 35,
    tags: ["vip", "beta"],
    lastLogin: new Date("2024-03-20T00:00:00.000Z"),
  },
  {
    id: 4,
    email: "dora@example.com",
    status: "active",
    age: 22,
    tags: [],
    nickname: "do",
    lastLogin: new Date("2023-12-31T00:00:00.000Z"),
  },
];

function createOperatorDb(): MimicDB<OperatorUserRecord> {
  return new MimicDB<OperatorUserRecord>({
    initialData: operatorUsers,
    keyField: "id",
  });
}

test("find supports in and not operators", () => {
  const db = createOperatorDb();

  const result = db.find({
    status: { in: ["active", "pending"] },
    id: { not: 1 },
  });

  assert.deepEqual(
    result.map((record) => record.id),
    [3, 4],
  );
});

test("find supports contains and startsWith for string and array fields", () => {
  const db = createOperatorDb();

  const result = db.find({
    email: { contains: "@example.com" },
    tags: { contains: "vip" },
    nickname: { startsWith: "al" },
  });

  assert.deepEqual(
    result.map((record) => record.id),
    [1],
  );
});

test("find supports comparable operators and returns false for type mismatches", () => {
  const db = createOperatorDb();
  const mismatchedQuery = {
    age: { gt: "30" },
  } as unknown as MimicDBQuery<OperatorUserRecord>;

  const result = db.find({
    age: { gt: 25, lte: 35 },
    lastLogin: {
      gte: new Date("2024-01-01T00:00:00.000Z"),
      lt: new Date("2024-03-01T00:00:00.000Z"),
    },
  });

  assert.deepEqual(
    result.map((record) => record.id),
    [1],
  );
  assert.equal(db.find(mismatchedQuery).length, 0);
});

test("find supports nested and/or logical composition", () => {
  const db = createOperatorDb();

  const result = db.find({
    or: [
      {
        and: [
          { status: { in: ["active", "pending"] } },
          { tags: { contains: "vip" } },
        ],
      },
      { email: { startsWith: "bob" } },
    ],
  });

  assert.deepEqual(
    result.map((record) => record.id),
    [1, 2, 3],
  );
});

test("operator queries handle missing and null fields deterministically", () => {
  const db = createOperatorDb();

  const containsResult = db.find({ nickname: { contains: "al" } });
  const notStartsWithResult = db.find({
    nickname: { not: { startsWith: "al" } },
  });

  assert.deepEqual(
    containsResult.map((record) => record.id),
    [1],
  );
  assert.deepEqual(
    notStartsWithResult.map((record) => record.id),
    [2, 3, 4],
  );
});

test("update and remove accept operator-based queries", () => {
  const db = createOperatorDb();

  const updated = db.update({ age: { gte: 35 } }, { status: "inactive" });
  const removed = db.remove({
    or: [{ tags: { contains: "vip" } }, { email: { startsWith: "bob" } }],
  });

  assert.deepEqual(
    updated.map((record) => record.id),
    [2, 3],
  );
  assert.equal(updated[1]?.status, "inactive");
  assert.equal(removed, 3);
  assert.deepEqual(
    db.getAll().map((record) => record.id),
    [4],
  );
});
