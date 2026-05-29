import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { BrandService } from './brand.service';
import { BrandController } from './brand.controller';
import { BrandRepository } from './brand.repository';
import { RedisModule } from '../../providers/redis/redis.module';

@Module({
  imports: [CacheModule.register({}), RedisModule],
  controllers: [BrandController],
  providers: [BrandService, BrandRepository],
  exports: [BrandService],
})
export class BrandModule {}
