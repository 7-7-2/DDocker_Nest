import {
  Injectable,
  InternalServerErrorException,
  HttpException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { MysqlService } from '../../providers/mysql/mysql.service';

export interface TransactionOptions {
  logger: Logger;
  message: string;
  context: string;
}

@Injectable()
export class TransactionManager {
  constructor(private readonly mysql: MysqlService) {}

  /**
   * Runs a callback within a database transaction with standardized error handling.
   * @param work A function that performs database operations using the provided QueryRunner.
   * @param options Logging and error context options.
   * @returns The result of the work function.
   */
  async run<T>(
    work: (queryRunner: QueryRunner) => Promise<T>,
    options: TransactionOptions,
  ): Promise<T> {
    const queryRunner = await this.mysql.getQueryRunner();
    // getQueryRunner already calls connect() in this project's MysqlService
    await queryRunner.startTransaction();

    try {
      const result = await work(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      // 1. If it's already a NestJS HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // 2. Handle DB Specific Errors (e.g., MySQL Unique Constraint 1062)
      if (error.errno === 1062) {
        throw new ConflictException('Already exists');
      }

      // 3. Log unknown 500 errors with full context
      options.logger.error(
        `[${options.context}] ${options.message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(options.message);
    } finally {
      await queryRunner.release();
    }
  }
}
