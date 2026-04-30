## MimicDB

```text
 __  __ _       _      ____  ____
|  \/  (_)_ __ (_) ___|  _ \| __ )
| |\/| | | '_ \| |/ __| | | |  _ \
| |  | | | | | | | (__| |_| | |_) |
|_|  |_|_|_| |_|_|\___|____/|____/
```

```text
             _.-========-._
         .-='  .-"""""-.   '=-.
       .'      /  .--.  \      '.
      /_______|  (o)(o)  |_______\
      |  _  _ |    __    | _  _  |
      | | || || .-'  '-. || || | |
      | |_||_||/  .--.  \||_||_| |
      |  __  | | (vvvv) | |  __  |
      | |  | |  \ '--' /  | |  | |
      | |__| |___'----'___| |__| |
      |______ / / /||\ \ \ ______|
     /______ /_/ /_||_\ \_\______\
```

MimicDB คือ TypeScript library สำหรับจัดการ mock data แบบ in-memory ให้ใช้งานคล้ายฐานข้อมูลขนาดเล็กภายใน test โดยเน้น workflow ที่พบบ่อยใน unit test และ integration test เช่น ค้นหาข้อมูลตาม field, upsert ข้อมูล, update หลายแถว, reset state และควบคุมข้อมูลเริ่มต้นของแต่ละรอบทดสอบ

## ความสามารถหลัก

- ค้นหาข้อมูลด้วย object query หรือ predicate function
- ดึงข้อมูลหนึ่งรายการหรือหลายรายการจาก field ต่าง ๆ
- `save` แบบ upsert ด้วย `keyField`
- `update` ข้อมูลที่ตรงเงื่อนไข
- `remove` ข้อมูลที่ตรงเงื่อนไข
- adapter สำหรับทำ TypeORM-style repository mock ใน test
- `seed` และ `reset` state เพื่อใช้ซ้ำใน test หลายเคส
- clone ข้อมูลก่อนคืนค่า เพื่อกันการแก้ไขจากภายนอกหลุดกลับเข้า store

## เอกสารเพิ่มเติม

- [TypeORM-style Repository Mock](docs/typeorm-mock-repository.md)

## การติดตั้ง

```bash
npm install mimicdatabox
```

## คำสั่งที่มีให้

```bash
npm run build
npm test
```

## ตัวอย่างการใช้งาน

```ts
import { MimicDB } from "mimicdatabox";

interface UserRecord {
  id: number;
  email: string;
  status: "active" | "inactive";
}

const users = new MimicDB<UserRecord>({
  keyField: "id",
  initialData: [
    { id: 1, email: "alice@example.com", status: "active" },
    { id: 2, email: "bob@example.com", status: "inactive" },
  ],
});

const activeUsers = users.find({ status: "active" });
const alice = users.findOne({ email: "alice@example.com" });

users.save({ id: 2, email: "bob@example.com", status: "active" });
users.update({ status: "active" }, { status: "inactive" });
users.reset();
```

## TypeORM-style Repository Mock

ดูคู่มือแยกที่ [docs/typeorm-mock-repository.md](docs/typeorm-mock-repository.md) สำหรับ:

- quick start ของ `createTypeOrmRepositoryMock(store, options)`
- ตัวอย่าง relation hydration และ array input ของ `save()` / `remove()`
- ตัวอย่าง NestJS service test พร้อม `getRepositoryToken()` และ `@InjectRepository()`
- สรุป API ของ adapter

## API หลัก

### `new MimicDB<T>(options)`

- `initialData`: ข้อมูลตั้งต้นของ store
- `keyField`: field ที่ใช้สำหรับ `save` แบบ upsert เช่น `id`

### Methods

- `count()` คืนจำนวนข้อมูลทั้งหมด
- `getAll()` คืนข้อมูลทั้งหมด
- `find(query?)` คืนข้อมูลที่ตรงเงื่อนไข
- `findOne(query)` คืนข้อมูลรายการแรกที่ตรงเงื่อนไข
- `save(record)` เพิ่มหรืออัปเดตข้อมูลตาม `keyField`
- `update(query, update)` อัปเดตข้อมูลทุก record ที่ตรงเงื่อนไข
- `remove(query)` ลบข้อมูลที่ตรงเงื่อนไขและคืนจำนวนที่ลบ
- `seed(data)` แทนที่ข้อมูลเริ่มต้นและข้อมูลปัจจุบัน
- `reset()` คืนค่ากลับไปยังข้อมูลตั้งต้นล่าสุด
- `createTypeOrmRepositoryMock(store, options)` สร้าง repository mock แนว TypeORM สำหรับ service test

## โครงสร้างโปรเจ็กต์

```text
.
|-- package.json
|-- tsconfig.json
|-- tsconfig.build.json
|-- tsconfig.test.json
|-- docs/
|   `-- typeorm-mock-repository.md
|-- src/
|   |-- MimicDB.ts
|   |-- index.ts
|   `-- typeorm-mock-repository/
|       |-- createTypeOrmRepositoryMock.ts
|       `-- index.ts
|-- test/
|   |-- MimicDB.test.ts
|   `-- typeorm-mock-repository/
|       `-- createTypeOrmRepositoryMock.test.ts
`-- readme.md
```

## หมายเหตุการออกแบบ

- query แบบ object ใช้การเทียบค่าแบบ exact match ต่อ field
- query แบบ function เหมาะกับเงื่อนไขที่ซับซ้อนกว่า object query
- ข้อมูลที่คืนจาก library จะเป็น clone เสมอ เพื่อกัน side effect ระหว่าง test
- `save` จะ throw error ถ้ากำหนด `keyField` แต่ record ไม่มี field ดังกล่าว
