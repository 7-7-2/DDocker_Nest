import { Controller, Param, Sse, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { Observable } from 'rxjs';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Sse(':userId')
  sse(@Param('userId') userId: string): Observable<any> {
    return this.notificationService.getNotificationStream(userId);
  }
}
