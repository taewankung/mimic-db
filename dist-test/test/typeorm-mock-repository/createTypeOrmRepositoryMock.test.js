"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const src_1 = require("../../src");
const initialUsers = [
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
const rolesById = new Map([
    [101, { id: 101, name: "admin" }],
    [102, { id: 102, name: "viewer" }],
]);
(0, node_test_1.default)("createTypeOrmRepositoryMock supports TypeORM-style where options", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db);
    const user = await repository.findOne({
        where: { profile: { nickname: "alice" } },
    });
    const missing = await repository.findOne({
        where: { email: "missing@example.com" },
    });
    strict_1.default.equal(user?.id, 1);
    strict_1.default.equal(missing, null);
});
(0, node_test_1.default)("createTypeOrmRepositoryMock create does not persist and save upserts records", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db);
    const created = repository.create({
        id: 3,
        email: "charlie@example.com",
        status: "active",
        roleId: 102,
        profile: { nickname: "charlie" },
    });
    strict_1.default.equal(db.count(), 2);
    strict_1.default.equal(created.id, 3);
    const inserted = (await repository.save(created));
    const updated = (await repository.save({
        id: 2,
        email: "bob@example.com",
        status: "active",
        roleId: 102,
        profile: { nickname: "builder" },
    }));
    strict_1.default.equal(inserted.id, 3);
    strict_1.default.equal(updated.profile.nickname, "builder");
    strict_1.default.equal(db.count(), 3);
});
(0, node_test_1.default)("createTypeOrmRepositoryMock save accepts array input", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db);
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
    ]));
    strict_1.default.equal(saved.length, 2);
    strict_1.default.equal(saved[0]?.profile.nickname, "builder");
    strict_1.default.equal(saved[1]?.id, 3);
    strict_1.default.equal(db.count(), 3);
    strict_1.default.equal(db.findOne({ id: 2 })?.status, "active");
    strict_1.default.equal(db.findOne({ id: 3 })?.email, "charlie@example.com");
});
(0, node_test_1.default)("createTypeOrmRepositoryMock supports find, count, update, delete, and remove", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db);
    const inactiveUsers = await repository.find({
        where: { status: "inactive" },
    });
    const inactiveCount = await repository.count({
        where: { status: "inactive" },
    });
    const updateResult = await repository.update({ status: "inactive" }, { status: "active" });
    const deleteResult = await repository.delete({ email: "bob@example.com" });
    const alice = await repository.findOneBy({ id: 1 });
    const removed = await repository.remove(alice);
    strict_1.default.equal(inactiveUsers.length, 1);
    strict_1.default.equal(inactiveCount, 1);
    strict_1.default.equal(updateResult.affected, 1);
    strict_1.default.equal(updateResult.records[0]?.status, "active");
    strict_1.default.equal(deleteResult.affected, 1);
    strict_1.default.equal(removed.id, 1);
    strict_1.default.equal(db.count(), 0);
});
(0, node_test_1.default)("createTypeOrmRepositoryMock can hydrate relations through options", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db, {
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
    strict_1.default.equal(plainUser?.role, undefined);
    strict_1.default.deepEqual(hydratedUser?.role, { id: 101, name: "admin" });
});
(0, node_test_1.default)("createTypeOrmRepositoryMock remove accepts array input", async () => {
    const db = new src_1.MimicDB({
        initialData: initialUsers,
        keyField: "id",
    });
    const repository = (0, src_1.createTypeOrmRepositoryMock)(db);
    const removableUsers = (await repository.save([
        {
            id: 3,
            email: "charlie@example.com",
            status: "active",
            roleId: 102,
            profile: { nickname: "charlie" },
        },
    ]));
    const alice = (await repository.findOneBy({ id: 1 }));
    const removed = (await repository.remove([
        alice,
        removableUsers[0],
    ]));
    strict_1.default.deepEqual(removed.map((record) => record.id), [1, 3]);
    strict_1.default.equal(db.count(), 1);
    strict_1.default.equal(db.findOne({ id: 1 }), undefined);
    strict_1.default.equal(db.findOne({ id: 3 }), undefined);
});
