import { Module, forwardRef } from '@nestjs/common';
import { CaffeineService } from './caffeine.service';
import { CaffeineController } from './caffeine.controller';
import { CaffeineRepository } from './caffeine.repository';
import { BrandModule } from '../brand/brand.module';
import { RedisModule } from '../../providers/redis/redis.module';
import { PostModule } from '../post/post.module';

@Module({
  imports: [BrandModule, RedisModule, forwardRef(() => PostModule)],
  controllers: [CaffeineController],
  providers: [CaffeineService, CaffeineRepository],
  exports: [CaffeineService, CaffeineRepository],
})
export class CaffeineModule {}
