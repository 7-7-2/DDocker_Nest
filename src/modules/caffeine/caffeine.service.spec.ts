import { Test, TestingModule } from '@nestjs/testing';
import { CaffeineService } from './caffeine.service';

describe('CaffeineService', () => {
  let service: CaffeineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaffeineService],
    }).compile();

    service = module.get<CaffeineService>(CaffeineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
