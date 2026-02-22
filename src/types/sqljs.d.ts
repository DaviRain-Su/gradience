declare module "sql.js" {
  type SqlJsConfig = { locateFile?: (file: string) => string };
  type Database = any;
  export default function initSqlJs(config?: SqlJsConfig): Promise<{ Database: new (data?: Uint8Array) => Database }>;
}
