import { Test, TestingModule } from '@nestjs/testing';
import { CaffeineController } from './caffeine.controller';
import { CaffeineService } from './caffeine.service';

describe('CaffeineController', () => {
  let controller: CaffeineController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaffeineController],
      providers: [CaffeineService],
    }).compile();

    controller = module.get<CaffeineController>(CaffeineController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
