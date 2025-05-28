import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
//1. entry point
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //16. app.setGlobalPrefix('api')
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
