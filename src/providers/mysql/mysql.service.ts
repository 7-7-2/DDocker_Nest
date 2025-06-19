import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class MysqlService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly dataSource: DataSource) {}

  // Lifecycle hooks
  async onModuleInit() {
    if (this.dataSource.isInitialized) {
      console.log('DatabaseService: DataSource is already initialized.');
    }
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize();
      console.log('DatabaseService: DataSource initialized.');
    }
  }

  async onModuleDestroy() {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      console.log('DatabaseService: DataSource destroyed.');
    }
  }

  async executeQuery<T>(query: string, parameters?: any[]): Promise<T[]> {
    try {
      const result: any[] = await this.dataSource.query(query, parameters);
      return result as T[];
    } catch (error) {
      if (error instanceof Error)
        console.error(
          'DatabaseService: Error executing query:',
          error.message,
          'Query:',
          query,
        );
      throw error;
    }
  }

  async getQueryRunner() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    return queryRunner;
  }
}
