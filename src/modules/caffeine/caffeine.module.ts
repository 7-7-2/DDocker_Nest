import { Module } from '@nestjs/common';
import { CaffeineService } from './caffeine.service';
import { CaffeineController } from './caffeine.controller';
import { CaffeineRepository } from './caffeine.repository';
import { BrandModule } from '../brand/brand.module';

@Module({
  imports: [BrandModule],
  controllers: [CaffeineController],
  providers: [CaffeineService, CaffeineRepository],
  exports: [CaffeineService, CaffeineRepository],
})
export class CaffeineModule {}
