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
import {
  TodayCaffeineResponseDto,
  WeeklyStatsResponseDto,
} from './dto/caffeine-stats.dto';

@ApiTags('Caffeine')
@Controller('caffeine')
export class CaffeineController {
  constructor(private readonly caffeineService: CaffeineService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('intake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '빠르게 기록하기(caffeine_intake)' })
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
  @Get('today')
  @ApiOperation({ summary: '오늘 카페인 섭취(메인 페이지)' })
  @ApiResponse({ status: 200, type: TodayCaffeineResponseDto })
  async getTodayConsumption(
    @GetUser('public_id') userId: string,
  ): Promise<TodayCaffeineResponseDto> {
    return await this.caffeineService.getTodayConsumption(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('stats/weekly')
  @ApiOperation({ summary: '6주 섭취 동향(주당 몇 잔)' })
  @ApiResponse({ status: 200, type: WeeklyStatsResponseDto })
  async getWeeklyTrend(
    @GetUser('public_id') userId: string,
  ): Promise<WeeklyStatsResponseDto> {
    return await this.caffeineService.getWeeklyTrend(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('calendar')
  @ApiOperation({
    summary: '섭취기록 달력 조회',
  })
  @ApiResponse({ status: 200, type: CaffeineMonthlyViewDto })
  async getMonthlyView(
    @GetUser('public_id') userId: string,
    @Query('date') date: string, // Expecting YYYY-MM-DD
  ): Promise<CaffeineMonthlyViewDto> {
    return await this.caffeineService.getMonthlyView(userId, date);
  }
}
