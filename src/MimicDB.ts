export type MimicDBQuery<T> = Partial<T> | ((record: T) => boolean);

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

    return Object.entries(query as Record<string, unknown>).every(
      ([key, value]) => {
        return Object.is((record as Record<string, unknown>)[key], value);
      },
    );
  }
}
