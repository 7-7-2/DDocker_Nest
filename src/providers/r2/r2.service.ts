import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async getPresignedUploadUrl(path: string): Promise<{ url: string }> {
    try {
      const url = await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: `assets/${path}`,
        }),
        { expiresIn: 20 },
      );
      return { url };
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  async getPresignedDeleteUrl(path: string): Promise<{ url: string }> {
    try {
      const url = await getSignedUrl(
        this.client,
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: `assets/${path}`,
        }),
        { expiresIn: 20 },
      );
      return { url };
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate delete URL');
    }
  }

  async deleteAllFolderItems(folderPath: string): Promise<boolean> {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `assets/${folderPath}`,
      });

      const listResult = await this.client.send(listCommand);
      const objects = listResult.Contents?.map((item) => ({ Key: item.Key }));

      if (objects && objects.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: { Objects: objects },
        });
        await this.client.send(deleteCommand);
      }

      return true;
    } catch (error) {
      throw new InternalServerErrorException('Failed to delete folder items');
    }
  }
}
