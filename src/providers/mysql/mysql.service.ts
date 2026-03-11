import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Standard MySQL result header for INSERT/UPDATE/DELETE.
 */
export interface MySqlResultSetHeader {
  fieldCount: number;
  affectedRows: number;
  insertId: number;
  info: string;
  serverStatus: number;
  warningStatus: number;
  changedRows: number;
}

@Injectable()
export class MysqlService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  /**
   * For SELECT queries.
   */
  async query<T>(query: string, parameters?: unknown[]): Promise<T[]> {
    try {
      const result: unknown = await this.dataSource.query(query, parameters);
      if (!Array.isArray(result)) {
        throw new Error('Query did not return an array.');
      }
      // Narrowing the any/unknown to T[] after verification
      return result as T[];
    } catch (error) {
      this.handleError(error, query);
      throw error;
    }
  }

  /**
   * For INSERT, UPDATE, DELETE queries.
   */
  async execute(
    query: string,
    parameters?: unknown[],
  ): Promise<MySqlResultSetHeader> {
    try {
      const result: unknown = await this.dataSource.query(query, parameters);
      if (this.isResultSetHeader(result)) {
        return result;
      }
      throw new Error('Execute did not return a ResultSetHeader.');
    } catch (error) {
      this.handleError(error, query);
      throw error;
    }
  }

  async getQueryRunner(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    return queryRunner;
  }

  /**
   * Type Guard to verify ResultSetHeader.
   */
  isResultSetHeader(result: unknown): result is MySqlResultSetHeader {
    return (
      result !== null &&
      typeof result === 'object' &&
      'affectedRows' in result &&
      'insertId' in result
    );
  }

  private handleError(error: unknown, query: string): void {
    if (error instanceof Error) {
      console.error(`DB Error: ${error.message} | Query: ${query}`);
    }
  }
}
