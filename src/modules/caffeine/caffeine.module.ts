import { Module } from '@nestjs/common';
import { CaffeineService } from './caffeine.service';
import { CaffeineController } from './caffeine.controller';
import { CaffeineRepository } from './caffeine.repository';

@Module({
  controllers: [CaffeineController],
  providers: [CaffeineService, CaffeineRepository],
  exports: [CaffeineService, CaffeineRepository],
})
export class CaffeineModule {}
