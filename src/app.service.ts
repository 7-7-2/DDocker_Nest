import { Injectable } from '@nestjs/common';
//12. where logic lives, invoked by controllers like
//constructor(private readonly appService : AppService){}
//in charge of instantiating
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
