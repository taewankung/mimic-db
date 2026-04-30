"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MimicDB = void 0;
function cloneValue(value) {
    return structuredClone(value);
}
function cloneArray(value) {
    return structuredClone([...value]);
}
class MimicDB {
    keyField;
    seedData;
    records;
    constructor(options = {}) {
        this.keyField = options.keyField;
        this.seedData = cloneArray(options.initialData ?? []);
        this.records = cloneArray(this.seedData);
    }
    getKeyField() {
        return this.keyField;
    }
    count() {
        return this.records.length;
    }
    getAll() {
        return cloneArray(this.records);
    }
    find(query) {
        return cloneArray(this.records.filter((record) => this.matches(record, query)));
    }
    findOne(query) {
        const record = this.records.find((entry) => this.matches(entry, query));
        return record === undefined ? undefined : cloneValue(record);
    }
    save(record) {
        const nextRecord = cloneValue(record);
        if (this.keyField === undefined) {
            this.records.push(nextRecord);
            return cloneValue(nextRecord);
        }
        const keyValue = nextRecord[this.keyField];
        if (keyValue === undefined) {
            throw new Error(`Missing key field \"${String(this.keyField)}\" on record.`);
        }
        const index = this.records.findIndex((entry) => Object.is(entry[this.keyField], keyValue));
        if (index >= 0) {
            this.records[index] = nextRecord;
        }
        else {
            this.records.push(nextRecord);
        }
        return cloneValue(nextRecord);
    }
    update(query, update) {
        const updatedRecords = [];
        this.records = this.records.map((record) => {
            if (!this.matches(record, query)) {
                return record;
            }
            const nextRecord = typeof update === "function"
                ? cloneValue(update(cloneValue(record)))
                : { ...cloneValue(record), ...update };
            updatedRecords.push(cloneValue(nextRecord));
            return nextRecord;
        });
        return updatedRecords;
    }
    remove(query) {
        const before = this.records.length;
        this.records = this.records.filter((record) => !this.matches(record, query));
        return before - this.records.length;
    }
    seed(data) {
        this.seedData = cloneArray(data);
        this.records = cloneArray(data);
    }
    reset() {
        this.records = cloneArray(this.seedData);
    }
    matches(record, query) {
        if (query === undefined) {
            return true;
        }
        if (typeof query === "function") {
            return query(cloneValue(record));
        }
        return Object.entries(query).every(([key, value]) => {
            return Object.is(record[key], value);
        });
    }
}
exports.MimicDB = MimicDB;
