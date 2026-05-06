export interface MimicDBFieldOperators<T> {
  in?: readonly T[];
  not?: MimicDBFieldQuery<T>;
  contains?: T extends readonly (infer TItem)[] ? TItem : string;
  startsWith?: string;
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
}

export type MimicDBFieldQuery<T> = T | MimicDBFieldOperators<T>;

export type MimicDBObjectQuery<T extends object> = Partial<{
  [K in keyof T]: MimicDBFieldQuery<T[K]>;
}> & {
  and?: readonly MimicDBQuery<T>[];
  or?: readonly MimicDBQuery<T>[];
};

export type MimicDBQuery<T extends object> =
  | MimicDBObjectQuery<T>
  | ((record: T) => boolean);

export type MimicDBUpdate<T> = Partial<T> | ((record: T) => T);

export interface MimicDBOptions<T extends object> {
  initialData?: readonly T[];
  keyField?: keyof T;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function cloneArray<T>(value: readonly T[]): T[] {
  return structuredClone([...value]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const logicalOperatorKeys = new Set(["and", "or"]);
const fieldOperatorKeys = new Set([
  "in",
  "not",
  "contains",
  "startsWith",
  "gt",
  "gte",
  "lt",
  "lte",
]);

function isFieldOperatorObject(
  value: unknown,
): value is MimicDBFieldOperators<unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).some((key) => fieldOperatorKeys.has(key))
  );
}

function compareComparableValues(
  actual: unknown,
  expected: unknown,
): number | undefined {
  if (actual instanceof Date || expected instanceof Date) {
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() - expected.getTime();
    }

    return undefined;
  }

  if (typeof actual !== typeof expected) {
    return undefined;
  }

  if (typeof actual === "number") {
    const expectedNumber = expected as number;

    if (Number.isNaN(actual) || Number.isNaN(expectedNumber)) {
      return undefined;
    }

    return actual - expectedNumber;
  }

  if (typeof actual === "bigint") {
    const expectedBigInt = expected as bigint;

    if (actual < expectedBigInt) {
      return -1;
    }

    if (actual > expectedBigInt) {
      return 1;
    }

    return 0;
  }

  if (typeof actual === "string") {
    return actual.localeCompare(expected as string);
  }

  return undefined;
}

export class MimicDB<T extends object> {
  private readonly keyField?: keyof T;
  private seedData: T[];
  private records: T[];

  constructor(options: MimicDBOptions<T> = {}) {
    this.keyField = options.keyField;
    this.seedData = cloneArray(options.initialData ?? []);
    this.records = cloneArray(this.seedData);
  }

  getKeyField(): keyof T | undefined {
    return this.keyField;
  }

  count(): number {
    return this.records.length;
  }

  getAll(): T[] {
    return cloneArray(this.records);
  }

  find(query?: MimicDBQuery<T>): T[] {
    return cloneArray(
      this.records.filter((record) => this.matches(record, query)),
    );
  }

  findOne(query: MimicDBQuery<T>): T | undefined {
    const record = this.records.find((entry) => this.matches(entry, query));
    return record === undefined ? undefined : cloneValue(record);
  }

  save(record: T): T {
    const nextRecord = cloneValue(record);

    if (this.keyField === undefined) {
      this.records.push(nextRecord);
      return cloneValue(nextRecord);
    }

    const keyValue = nextRecord[this.keyField];

    if (keyValue === undefined) {
      throw new Error(
        `Missing key field \"${String(this.keyField)}\" on record.`,
      );
    }

    const index = this.records.findIndex((entry) =>
      Object.is(entry[this.keyField!], keyValue),
    );

    if (index >= 0) {
      this.records[index] = nextRecord;
    } else {
      this.records.push(nextRecord);
    }

    return cloneValue(nextRecord);
  }

  update(query: MimicDBQuery<T>, update: MimicDBUpdate<T>): T[] {
    const updatedRecords: T[] = [];

    this.records = this.records.map((record) => {
      if (!this.matches(record, query)) {
        return record;
      }

      const nextRecord =
        typeof update === "function"
          ? cloneValue(update(cloneValue(record)))
          : ({ ...cloneValue(record), ...update } as T);

      updatedRecords.push(cloneValue(nextRecord));
      return nextRecord;
    });

    return updatedRecords;
  }

  remove(query: MimicDBQuery<T>): number {
    const before = this.records.length;
    this.records = this.records.filter(
      (record) => !this.matches(record, query),
    );
    return before - this.records.length;
  }

  seed(data: readonly T[]): void {
    this.seedData = cloneArray(data);
    this.records = cloneArray(data);
  }

  reset(): void {
    this.records = cloneArray(this.seedData);
  }

  private matches(record: T, query?: MimicDBQuery<T>): boolean {
    if (query === undefined) {
      return true;
    }

    if (typeof query === "function") {
      return query(cloneValue(record));
    }

    return this.matchesObjectQuery(
      record as Record<string, unknown>,
      query as MimicDBObjectQuery<T>,
    );
  }

  private matchesObjectQuery(
    record: Record<string, unknown>,
    query: MimicDBObjectQuery<T>,
  ): boolean {
    const queryRecord = query as Record<string, unknown>;
    const andQueries = Array.isArray(queryRecord.and)
      ? (queryRecord.and as readonly MimicDBQuery<T>[])
      : undefined;
    const orQueries = Array.isArray(queryRecord.or)
      ? (queryRecord.or as readonly MimicDBQuery<T>[])
      : undefined;

    const fieldEntries = Object.entries(queryRecord).filter(([key, value]) => {
      return !(logicalOperatorKeys.has(key) && Array.isArray(value));
    });

    const fieldsMatch = fieldEntries.every(([key, value]) => {
      return this.matchesFieldCondition(record[key], value);
    });

    const andMatch =
      andQueries === undefined ||
      andQueries.every((nestedQuery) => this.matches(record as T, nestedQuery));

    const orMatch =
      orQueries === undefined ||
      orQueries.some((nestedQuery) => this.matches(record as T, nestedQuery));

    return fieldsMatch && andMatch && orMatch;
  }

  private matchesFieldCondition(value: unknown, condition: unknown): boolean {
    if (isFieldOperatorObject(condition)) {
      return this.matchesOperatorObject(value, condition);
    }

    return Object.is(value, condition);
  }

  private matchesOperatorObject(
    value: unknown,
    operators: MimicDBFieldOperators<unknown>,
  ): boolean {
    return Object.entries(operators as Record<string, unknown>).every(
      ([operator, operand]) => {
        switch (operator) {
          case "in":
            return (
              Array.isArray(operand) &&
              operand.some((candidate) => Object.is(value, candidate))
            );
          case "not":
            return !this.matchesFieldCondition(value, operand);
          case "contains":
            if (typeof value === "string" && typeof operand === "string") {
              return value.includes(operand);
            }

            if (Array.isArray(value)) {
              return value.some((entry) => Object.is(entry, operand));
            }

            return false;
          case "startsWith":
            return typeof value === "string" && typeof operand === "string"
              ? value.startsWith(operand)
              : false;
          case "gt":
            return this.matchesComparison(
              value,
              operand,
              (result) => result > 0,
            );
          case "gte":
            return this.matchesComparison(
              value,
              operand,
              (result) => result >= 0,
            );
          case "lt":
            return this.matchesComparison(
              value,
              operand,
              (result) => result < 0,
            );
          case "lte":
            return this.matchesComparison(
              value,
              operand,
              (result) => result <= 0,
            );
          default:
            return false;
        }
      },
    );
  }

  private matchesComparison(
    value: unknown,
    operand: unknown,
    compare: (result: number) => boolean,
  ): boolean {
    const comparison = compareComparableValues(value, operand);
    return comparison === undefined ? false : compare(comparison);
  }
}
