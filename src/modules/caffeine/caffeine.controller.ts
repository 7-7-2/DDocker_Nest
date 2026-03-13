import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
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
import { CaffeineMonthlyViewDto } from './dto/caffeine-calendar.dto';

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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('calendar')
  @ApiOperation({
    summary: 'Get consolidated monthly view (Summary + Details)',
  })
  @ApiResponse({ status: 200, type: CaffeineMonthlyViewDto })
  async getMonthlyView(
    @GetUser('public_id') userId: string,
    @Query('date') date: string, // Expecting YYYY-MM-DD
  ): Promise<CaffeineMonthlyViewDto> {
    return await this.caffeineService.getMonthlyView(userId, date);
  }
}
