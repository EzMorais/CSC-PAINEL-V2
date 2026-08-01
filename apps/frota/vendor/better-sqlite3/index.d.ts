declare class Declaracao {
  raw(ligar?: boolean): this;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  values(...params: unknown[]): unknown[];
  columns(): { name: string }[];
}

declare class Database {
  constructor(caminho?: string);
  readonly name: string;
  readonly open: boolean;
  prepare(sql: string): Declaracao;
  exec(sql: string): this;
  pragma(texto: string): this;
  transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  close(): void;
}

export = Database;
