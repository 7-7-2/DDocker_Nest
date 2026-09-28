import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { PostRepository } from './post.repository';
import { CaffeineModule } from '../caffeine/caffeine.module';
import { BrandModule } from '../brand/brand.module';
import { IdempotencyModule } from '../../common/interceptors/idempotency.module';

@Module({
  imports: [CaffeineModule, BrandModule, IdempotencyModule],
  controllers: [PostController],
  providers: [PostService, PostRepository],
  exports: [PostService, PostRepository],
})
export class PostModule {}
