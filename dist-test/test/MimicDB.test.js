"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const src_1 = require("../src");
const initialUsers = [
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
(0, node_test_1.default)("find returns records matched by object query", () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const result = db.find({ status: "active", email: "alice@example.com" });
    strict_1.default.equal(result.length, 1);
    strict_1.default.equal(result[0]?.id, 1);
});
(0, node_test_1.default)("save updates an existing record when keyField matches", () => {
    const db = new src_1.MimicDB({
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
    strict_1.default.deepEqual(record, {
        id: 2,
        email: "bob@example.com",
        status: "active",
        profile: { nickname: "builder" },
    });
    strict_1.default.equal(db.count(), 2);
});
(0, node_test_1.default)("save inserts a new record when keyField does not exist yet", () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    db.save({
        id: 3,
        email: "charlie@example.com",
        status: "active",
        profile: { nickname: "charlie" },
    });
    strict_1.default.equal(db.count(), 3);
    strict_1.default.equal(db.findOne({ id: 3 })?.email, "charlie@example.com");
});
(0, node_test_1.default)("update patches every matched record", () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const updated = db.update({ status: "inactive" }, { status: "active" });
    strict_1.default.equal(updated.length, 1);
    strict_1.default.equal(updated[0]?.status, "active");
    strict_1.default.equal(db.find({ status: "active" }).length, 2);
});
(0, node_test_1.default)("remove deletes matched records", () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const removed = db.remove((record) => record.status === "inactive");
    strict_1.default.equal(removed, 1);
    strict_1.default.equal(db.count(), 1);
    strict_1.default.equal(db.findOne({ id: 2 }), undefined);
});
(0, node_test_1.default)("reset restores the original seed data", () => {
    const db = new src_1.MimicDB({
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
    strict_1.default.equal(db.count(), 2);
    strict_1.default.equal(db.findOne({ id: 1 })?.email, "alice@example.com");
    strict_1.default.equal(db.findOne({ id: 3 }), undefined);
});
(0, node_test_1.default)("returned data is cloned to avoid accidental mutation leaks", () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const record = db.findOne({ id: 1 });
    strict_1.default.ok(record);
    record.profile.nickname = "changed-outside";
    strict_1.default.equal(db.findOne({ id: 1 })?.profile.nickname, "alice");
});
