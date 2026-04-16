import { ApiProperty } from '@nestjs/swagger';

export type NotificationType = 'like' | 'comment' | 'follow';

export class NotificationPayloadDto {
  @ApiProperty({ enum: ['like', 'comment', 'follow'] })
  type: NotificationType;

  @ApiProperty()
  senderId: string;

  @ApiProperty()
  senderNickname: string;

  @ApiProperty({ required: false })
  postId?: string;

  @ApiProperty()
  time: string;
}

export class NotificationResponseDto extends NotificationPayloadDto {
  @ApiProperty()
  notificationId: string;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  timestamp: string;
}
