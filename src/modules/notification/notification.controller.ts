import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { Observable } from 'rxjs';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationResponseDto } from './dto/notification-payload.dto';

@ApiTags('Notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  //LIVE CONNECTION
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Sse(':userId')
  @ApiOperation({ summary: 'Real-time notification stream (SSE)' })
  sse(@Param('userId') userId: string): Observable<any> {
    return this.notificationService.getNotificationStream(userId);
  }

  //INITIAL FETCH
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get notification history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'ISO Timestamp of the last item',
  })
  async getHistory(
    @GetUser('public_id') userId: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ): Promise<{
    items: NotificationResponseDto[];
    nextCursor?: string;
    lastReadAt: string;
  }> {
    return await this.notificationService.getHistory(
      userId,
      limit ? Number(limit) : 20,
      cursor,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('read')
  @ApiOperation({ summary: 'Mark all notifications as read (tiemstamp)' })
  async markAllAsRead(@GetUser('public_id') userId: string) {
    return await this.notificationService.markAllAsRead(userId);
  }
}
