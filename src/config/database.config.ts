import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export const DatabaseConfigName = 'database';

export interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  extra: any;
}

//register as a namespace of config module
export default registerAs(
  DatabaseConfigName,
  (): DataSourceOptions => ({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT as string, 10) || 3306,
    username: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    timezone: 'Z',
    dateStrings: false,
    extra: {
      typeCast: (field, next) => {
        if (field.type === 'JSON') return JSON.parse(field.string());
        return next();
      },
      connectionLimit:
        parseInt(process.env.DB_CONNECTION_LIMIT as string, 10) || 10,
    },
  }),
);
