import { Module, Global } from '@nestjs/common';
import { MysqlService } from './mysql.service';
import { TransactionManager } from '../../common/database/transaction.manager';

@Global()
@Module({
  providers: [MysqlService, TransactionManager],
  exports: [MysqlService, TransactionManager],
})
export class MysqlModule {}
