"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTypeOrmRepositoryMock = createTypeOrmRepositoryMock;
function cloneValue(value) {
    return structuredClone(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function matchesWhereClause(record, where) {
    if (!isRecord(where)) {
        return Object.is(record, where);
    }
    if (!isRecord(record)) {
        return false;
    }
    return Object.entries(where).every(([key, expected]) => {
        const actual = record[key];
        if (isRecord(expected)) {
            return matchesWhereClause(actual, expected);
        }
        return Object.is(actual, expected);
    });
}
function matchesWhere(record, where) {
    if (where === undefined) {
        return true;
    }
    if (Array.isArray(where)) {
        return where.some((clause) => matchesWhereClause(record, clause));
    }
    return matchesWhereClause(record, where);
}
async function hydrateRecord(record, options, context) {
    const cloned = cloneValue(record);
    if (options.hydrate === undefined) {
        return cloned;
    }
    return cloneValue(await options.hydrate(cloned, { ...context, record: cloned }));
}
function normalizeArray(value) {
    return (Array.isArray(value) ? [...value] : [value]);
}
function resolveKeyField(store, options) {
    return options.keyField ?? store.getKeyField();
}
function createTypeOrmRepositoryMock(store, options = {}) {
    const keyField = resolveKeyField(store, options);
    return {
        create(entityLike) {
            if (Array.isArray(entityLike)) {
                return entityLike.map((entry) => cloneValue(entry));
            }
            return cloneValue(entityLike);
        },
        async find(findOptions) {
            const records = store.find((record) => matchesWhere(record, findOptions?.where));
            const hydratedRecords = await Promise.all(records.map((record) => hydrateRecord(record, options, {
                operation: "find",
                relations: findOptions?.relations,
                input: findOptions,
            })));
            return hydratedRecords;
        },
        async findBy(where) {
            return this.find({ where });
        },
        async findOne(optionsArg) {
            const record = store.findOne((entry) => matchesWhere(entry, optionsArg.where));
            if (record === undefined) {
                return null;
            }
            return hydrateRecord(record, options, {
                operation: "findOne",
                relations: optionsArg.relations,
                input: optionsArg,
            });
        },
        async findOneBy(where) {
            return this.findOne({ where });
        },
        async count(findOptions) {
            return store.find((record) => matchesWhere(record, findOptions?.where))
                .length;
        },
        async save(entity) {
            const entities = normalizeArray(entity);
            const saved = entities.map((entry) => store.save(entry));
            const hydrated = await Promise.all(saved.map((record) => hydrateRecord(record, options, {
                operation: "save",
                input: entity,
            })));
            return Array.isArray(entity) ? hydrated : hydrated[0];
        },
        async update(criteria, partialEntity) {
            const records = store.update((record) => matchesWhere(record, criteria), partialEntity);
            return {
                affected: records.length,
                records,
            };
        },
        async remove(entity) {
            const entities = normalizeArray(entity);
            const removed = [];
            for (const entry of entities) {
                const criteria = keyField !== undefined
                    ? { [keyField]: entry[keyField] }
                    : entry;
                const found = store.findOne((record) => matchesWhere(record, criteria));
                if (found !== undefined) {
                    store.remove((record) => matchesWhere(record, criteria));
                    removed.push(await hydrateRecord(found, options, {
                        operation: "remove",
                        input: entry,
                    }));
                }
            }
            return Array.isArray(entity) ? removed : removed[0];
        },
        async delete(criteria) {
            return {
                affected: store.remove((record) => matchesWhere(record, criteria)),
            };
        },
    };
}
