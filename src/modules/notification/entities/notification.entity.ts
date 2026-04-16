export interface NotificationRow {
  notificationId: string;
  receiverId: string;
  timestamp: string;
  senderId: string;
  senderNickname: string;
  type: 'like' | 'comment' | 'follow';
  postId?: string;
}
