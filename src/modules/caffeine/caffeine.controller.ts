import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CaffeineService } from './caffeine.service';
import { CreateCaffeineDto } from './dto/create-caffeine.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('caffeine')
@Controller('caffeine')
export class CaffeineController {
  constructor(private readonly caffeineService: CaffeineService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('intake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a new caffeine intake' })
  @ApiResponse({
    status: 201,
    description: 'Intake logged and user stats updated',
  })
  async logIntake(
    @GetUser('public_id') userId: string,
    @Body() createCaffeineDto: CreateCaffeineDto,
  ) {
    const intakeId = await this.caffeineService.logIntake(
      userId,
      createCaffeineDto,
    );
    return {
      success: true,
      intakeId,
    };
  }
}
