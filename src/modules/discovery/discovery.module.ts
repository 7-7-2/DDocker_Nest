import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRepository } from './discovery.repository';
import { BrandModule } from '../brand/brand.module';
import { RedisModule } from '../../providers/redis/redis.module';

@Module({
  imports: [BrandModule, RedisModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService, DiscoveryRepository],
})
export class DiscoveryModule {}
