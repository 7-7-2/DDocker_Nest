import { Injectable, ForbiddenException } from '@nestjs/common';
import { R2Service } from '../../providers/r2/r2.service';

@Injectable()
export class StorageService {
  constructor(private readonly r2Service: R2Service) {}

  async getUploadUrl(
    loggedInUserId: string,
    dir: string,
    userId: string,
    postId?: string,
  ): Promise<{ url: string }> {
    this.validateOwnership(loggedInUserId, userId);
    const path = postId ? `${dir}/${userId}/${postId}` : `${dir}/${userId}`;
    return await this.r2Service.getPresignedUploadUrl(path);
  }

  async getDeleteUrl(
    loggedInUserId: string,
    dir: string,
    userId: string,
    postId?: string,
  ): Promise<{ url: string }> {
    this.validateOwnership(loggedInUserId, userId);
    const path = postId ? `${dir}/${userId}/${postId}` : `${dir}/${userId}`;
    return await this.r2Service.getPresignedDeleteUrl(path);
  }

  async deleteFolder(
    loggedInUserId: string,
    dir: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    this.validateOwnership(loggedInUserId, userId);
    const success = await this.r2Service.deleteAllFolderItems(
      `${dir}/${userId}`,
    );
    return { success };
  }

  private validateOwnership(loggedInUserId: string, targetUserId: string) {
    if (loggedInUserId !== targetUserId) {
      throw new ForbiddenException('Unauthorized storage access');
    }
  }
}
