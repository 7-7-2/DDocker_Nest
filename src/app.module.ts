//Config Modules
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_PIPE, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { MysqlModule } from './providers/mysql/mysql.module';
import { RedisModule } from './providers/redis/redis.module';
//Application Modules
import { BrandModule } from './modules/brand/brand.module';
import { UserModule } from './modules/user/user.module';
import { SearchModule } from './modules/search/search.module';
import { ReportModule } from './modules/report/report.module';
import { SupportModule } from './modules/support/support.module';
import { CaffeineModule } from './modules/caffeine/caffeine.module';
import { LikeModule } from './modules/like/like.module';
import { FollowModule } from './modules/follow/follow.module';
import { PostModule } from './modules/post/post.module';
import { CommentModule } from './modules/comment/comment.module';
import { NotificationModule } from './modules/notification/notification.module';
//Configs
import serverConfig from './config/server.config';
import databaseConfig, { DatabaseConfigName } from './config/database.config';
import redisConfig from './config/redis.config';
import googleConfig from './config/strategy/google.config';
import kakaoConfig from './config/strategy/kakao.config';
import jwtConfig from './config/strategy/jwt.config';

import { DataSource, DataSourceOptions } from 'typeorm';
import { AuthModule } from './auth/auth.module';
//Common
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        serverConfig,
        databaseConfig,
        redisConfig,
        googleConfig,
        kakaoConfig,
        jwtConfig,
      ],
      cache: true,
      envFilePath: getEnvFilePath(),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: () => ({
          context: 'HTTP',
        }),
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              }
            : undefined,
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow(DatabaseConfigName),
      inject: [ConfigService],
      dataSourceFactory: async (options: DataSourceOptions) => {
        const dataSource = await new DataSource(options).initialize();
        return dataSource;
      },
    }),
    MysqlModule,
    RedisModule,
    //App Modules
    BrandModule,
    UserModule,
    SearchModule,
    PostModule,
    CommentModule,
    FollowModule,
    LikeModule,
    CaffeineModule,
    SupportModule,
    NotificationModule,
    ReportModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          //Strips/blocks unknown fields
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}

function getEnvFilePath() {
  return process.env.NODE_ENV === 'development'
    ? '.env.development'
    : '.env.production';
}
