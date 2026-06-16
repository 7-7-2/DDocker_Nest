import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Delete,
  Param,
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
import { TodayCaffeineResponseDto } from './dto/caffeine-stats.dto';
import { IntakeTrendResponseDto } from './dto/intake-trend.dto';

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
  @Get('analysis')
  @ApiOperation({ summary: '통계 분석 탭 데이터 조회' })
  @ApiResponse({ status: 200, type: IntakeTrendResponseDto })
  async getIntakeTrend(
    @GetUser('public_id') userId: string,
    @Query('date') date: string,
    @Query('unit') unit: 'weekly' | 'monthly',
  ): Promise<IntakeTrendResponseDto> {
    return await this.caffeineService.getIntakeTrend(userId, date, unit);
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('intake/:id/post')
  @ApiOperation({ summary: '카페인 섭취기록과 연결된 포스트 ID 조회' })
  @ApiResponse({
    status: 200,
    description: 'Post ID if exists, null otherwise',
  })
  async getPostAssociation(@Param('id') id: string) {
    const postId = await this.caffeineService.getPostByIntakeId(
      parseInt(id, 10),
    );
    return { postId };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('intake/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '카페인 섭취기록 삭제 (연결된 포스트 포함)' })
  @ApiResponse({
    status: 200,
    description: 'Intake and potential post deleted',
  })
  async deleteIntake(
    @GetUser('public_id') userId: string,
    @Param('id') id: string,
  ) {
    await this.caffeineService.deleteIntake(userId, parseInt(id, 10));
    return { success: true };
  }
}
