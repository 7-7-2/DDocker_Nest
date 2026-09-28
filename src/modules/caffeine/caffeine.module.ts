import { Module, forwardRef } from '@nestjs/common';
import { CaffeineService } from './caffeine.service';
import { CaffeineController } from './caffeine.controller';
import { CaffeineRepository } from './caffeine.repository';
import { BrandModule } from '../brand/brand.module';
import { RedisModule } from '../../providers/redis/redis.module';
import { PostModule } from '../post/post.module';
import { IdempotencyModule } from '../../common/interceptors/idempotency.module';

@Module({
  imports: [
    BrandModule,
    RedisModule,
    forwardRef(() => PostModule),
    IdempotencyModule,
  ],
  controllers: [CaffeineController],
  providers: [CaffeineService, CaffeineRepository],
  exports: [CaffeineService, CaffeineRepository],
})
export class CaffeineModule {}
