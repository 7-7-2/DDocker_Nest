import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrandModule } from './modules/brand/brand.module';
import { UserModule } from './modules/user/user.module';
import { UserController } from './modules/user/user.controller';
import { SearchModule } from './modules/search/search.module';
import { ReportModule } from './modules/report/report.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SupportModule } from './modules/support/support.module';
import { CoffeeModule } from './modules/coffee/coffee.module';
import { LikeModule } from './modules/like/like.module';
import { FollowModule } from './modules/follow/follow.module';
import { PostModule } from './modules/post/post.module';
//2. controllers invoke services
//4. nest g module 'module_name' => modules comprise module dependency tree
//5. nest g controller 'controller_name' => controller belongs to module
//6. nest g service 'service_name' => add a service into providers
//7. nest g resource 'crud_name' => spit out boilerplate codes
@Module({
  imports: [
    BrandModule,
    UserModule,
    SearchModule,
    PostModule,
    FollowModule,
    LikeModule,
    CoffeeModule,
    SupportModule,
    NotificationModule,
    ReportModule,
  ],
  controllers: [AppController, UserController],
  providers: [AppService],
})
export class AppModule {}
