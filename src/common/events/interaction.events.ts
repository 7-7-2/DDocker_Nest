export class PostLikedEvent {
  constructor(
    public readonly userId: string,
    public readonly likerNickname: string,
    public readonly postId: string,
    public readonly postOwnerId: string,
  ) {}
}

export class PostUnlikedEvent {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
  ) {}
}

export class CommentCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly commenterNickname: string,
    public readonly postId: string,
    public readonly postOwnerId: string,
    public readonly content: string,
  ) {}
}

export class ReplyCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly commenterNickname: string,
    public readonly postId: string,
    public readonly commentId: number,
    public readonly content: string,
  ) {}
}

export class CommentDeletedEvent {
  constructor(
    public readonly postId: string,
    public readonly commentId: number,
  ) {}
}

export class ReplyDeletedEvent {
  constructor(
    public readonly postId: string,
    public readonly commentId: number,
  ) {}
}

export class UserFollowedEvent {
  constructor(
    public readonly followerId: string,
    public readonly followerNickname: string,
    public readonly followedId: string,
  ) {}
}

export class UserUnfollowedEvent {
  constructor(
    public readonly followerId: string,
    public readonly followedId: string,
  ) {}
}
