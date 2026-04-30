import test from "node:test";
import assert from "node:assert/strict";

import { MimicDB } from "../src";

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
