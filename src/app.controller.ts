import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
//3. http requests => controller => service
//8. API endpoints within @Controller parameter
//9. @Get(:id) => optional path
//10. @Param('id') => parse out the param
//11. @Body() someDto : itr
//13. pipes => transforms data type (ParseIntPipe)
//class-validator ,class-transformer come handy when it comes to DTO validation
//14. validation pipe checks annotated decorators within DTO(@UsePipes(validationPipe))
//15. nest g guard 'auth' => sits in advance to whole controller or methods within it
//17.
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
