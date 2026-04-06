import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { PostModule } from '../post/post.module';
import { BrandModule } from '../brand/brand.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PostModule, BrandModule, forwardRef(() => AuthModule)],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
