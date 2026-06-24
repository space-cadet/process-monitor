declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      prepare(sql: string): Statement;
      exec(sql: string): void;
      transaction<T extends (...args: any[]) => any>(fn: T): T;
      pragma(pragma: string): any;
      close(): void;
    }

    interface Statement {
      run(...params: any[]): { lastInsertRowid: number | bigint; changes: number };
      get(...params: any[]): any;
      all(...params: any[]): any[];
      iterate(...params: any[]): IterableIterator<any>;
    }
  }

  interface DatabaseConstructor {
    new (filename: string, options?: any): Database.Database;
    (filename: string, options?: any): Database.Database;
  }

  const Database: DatabaseConstructor;
  export = Database;
}
