import { MimicDB } from "../MimicDB";

type MaybePromise<T> = T | Promise<T>;

type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date;

export type TypeOrmWhere<T> = {
  [K in keyof T]?: T[K] extends Primitive
    ? T[K]
    : T[K] extends readonly unknown[]
      ? T[K]
      : T[K] extends object
        ? TypeOrmWhere<T[K]> | T[K]
        : T[K];
};

export interface TypeOrmFindOneOptions<T extends object> {
  where: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[];
  relations?: unknown;
}

export interface TypeOrmFindManyOptions<T extends object> {
  where?: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[];
  relations?: unknown;
}

export interface TypeOrmUpdateResult<T extends object> {
  affected: number;
  records: T[];
}

export interface TypeOrmDeleteResult {
  affected: number;
}

export interface TypeOrmRepositoryMockHydrateContext<T extends object> {
  operation: "find" | "findOne" | "save" | "remove";
  relations?: unknown;
  input?: unknown;
  record?: T;
}

export interface TypeOrmRepositoryMockOptions<T extends object> {
  keyField?: keyof T;
  hydrate?: (
    record: T,
    context: TypeOrmRepositoryMockHydrateContext<T>,
  ) => MaybePromise<T>;
}

export interface TypeOrmRepositoryMock<T extends object> {
  create(entityLike: Partial<T> | readonly Partial<T>[]): T | T[];
  find(options?: TypeOrmFindManyOptions<T>): Promise<T[]>;
  findBy(where: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[]): Promise<T[]>;
  findOne(options: TypeOrmFindOneOptions<T>): Promise<T | null>;
  findOneBy(
    where: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
  ): Promise<T | null>;
  count(options?: TypeOrmFindManyOptions<T>): Promise<number>;
  save(entity: Partial<T> | readonly Partial<T>[]): Promise<T | T[]>;
  update(
    criteria: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
    partialEntity: Partial<T>,
  ): Promise<TypeOrmUpdateResult<T>>;
  remove(entity: T | readonly T[]): Promise<T | T[]>;
  delete(
    criteria: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
  ): Promise<TypeOrmDeleteResult>;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesWhereClause(record: unknown, where: unknown): boolean {
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

function matchesWhere<T extends object>(
  record: T,
  where?: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
): boolean {
  if (where === undefined) {
    return true;
  }

  if (Array.isArray(where)) {
    return where.some((clause) => matchesWhereClause(record, clause));
  }

  return matchesWhereClause(record, where);
}

async function hydrateRecord<T extends object>(
  record: T,
  options: TypeOrmRepositoryMockOptions<T>,
  context: TypeOrmRepositoryMockHydrateContext<T>,
): Promise<T> {
  const cloned = cloneValue(record);

  if (options.hydrate === undefined) {
    return cloned;
  }

  return cloneValue(
    await options.hydrate(cloned, { ...context, record: cloned }),
  );
}

function normalizeArray<T>(value: T | readonly T[]): T[] {
  return (Array.isArray(value) ? [...value] : [value]) as T[];
}

function resolveKeyField<T extends object>(
  store: MimicDB<T>,
  options: TypeOrmRepositoryMockOptions<T>,
): keyof T | undefined {
  return options.keyField ?? store.getKeyField();
}

export function createTypeOrmRepositoryMock<T extends object>(
  store: MimicDB<T>,
  options: TypeOrmRepositoryMockOptions<T> = {},
): TypeOrmRepositoryMock<T> {
  const keyField = resolveKeyField(store, options);

  return {
    create(entityLike: Partial<T> | readonly Partial<T>[]): T | T[] {
      if (Array.isArray(entityLike)) {
        return entityLike.map((entry) => cloneValue(entry as T));
      }

      return cloneValue(entityLike as T);
    },

    async find(findOptions?: TypeOrmFindManyOptions<T>): Promise<T[]> {
      const records = store.find((record) =>
        matchesWhere(record, findOptions?.where),
      );
      const hydratedRecords = await Promise.all(
        records.map((record) =>
          hydrateRecord(record, options, {
            operation: "find",
            relations: findOptions?.relations,
            input: findOptions,
          }),
        ),
      );

      return hydratedRecords;
    },

    async findBy(
      where: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
    ): Promise<T[]> {
      return this.find({ where });
    },

    async findOne(optionsArg: TypeOrmFindOneOptions<T>): Promise<T | null> {
      const record = store.findOne((entry) =>
        matchesWhere(entry, optionsArg.where),
      );

      if (record === undefined) {
        return null;
      }

      return hydrateRecord(record, options, {
        operation: "findOne",
        relations: optionsArg.relations,
        input: optionsArg,
      });
    },

    async findOneBy(
      where: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
    ): Promise<T | null> {
      return this.findOne({ where });
    },

    async count(findOptions?: TypeOrmFindManyOptions<T>): Promise<number> {
      return store.find((record) => matchesWhere(record, findOptions?.where))
        .length;
    },

    async save(entity: Partial<T> | readonly Partial<T>[]): Promise<T | T[]> {
      const entities = normalizeArray(entity);
      const saved = entities.map((entry) => store.save(entry as T));
      const hydrated = await Promise.all(
        saved.map((record) =>
          hydrateRecord(record, options, {
            operation: "save",
            input: entity,
          }),
        ),
      );

      return Array.isArray(entity) ? hydrated : hydrated[0]!;
    },

    async update(
      criteria: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
      partialEntity: Partial<T>,
    ): Promise<TypeOrmUpdateResult<T>> {
      const records = store.update(
        (record) => matchesWhere(record, criteria),
        partialEntity,
      );

      return {
        affected: records.length,
        records,
      };
    },

    async remove(entity: T | readonly T[]): Promise<T | T[]> {
      const entities = normalizeArray(entity);
      const removed: T[] = [];

      for (const entry of entities) {
        const criteria =
          keyField !== undefined
            ? ({ [keyField]: entry[keyField] } as TypeOrmWhere<T>)
            : (entry as TypeOrmWhere<T>);

        const found = store.findOne((record) => matchesWhere(record, criteria));

        if (found !== undefined) {
          store.remove((record) => matchesWhere(record, criteria));
          removed.push(
            await hydrateRecord(found, options, {
              operation: "remove",
              input: entry,
            }),
          );
        }
      }

      return Array.isArray(entity) ? removed : removed[0]!;
    },

    async delete(
      criteria: TypeOrmWhere<T> | readonly TypeOrmWhere<T>[],
    ): Promise<TypeOrmDeleteResult> {
      return {
        affected: store.remove((record) => matchesWhere(record, criteria)),
      };
    },
  };
}