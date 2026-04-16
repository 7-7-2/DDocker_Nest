import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbService implements OnModuleInit {
  private readonly logger = new Logger(DynamoDbService.name);
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  private readonly tableName = 'Notifications';

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('DYNAMO_ENDPOINT');
    const region = this.configService.get<string>('DYNAMO_REGION') || 'local';

    this.client = new DynamoDBClient({
      endpoint,
      region,
      credentials: {
        accessKeyId:
          this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'fake',
        secretAccessKey:
          this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'fake',
      },
    });

    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  async onModuleInit() {
    this.logger.log(
      'DynamoDbService initialized. Starting background table check...',
    );
    // Do NOT await here, let it run in the background so bootstrap can continue
    this.ensureTableExists().catch((err) => {
      this.logger.error('Background table check/creation failed', err);
    });
  }

  get db() {
    return this.docClient;
  }

  get table() {
    return this.tableName;
  }

  private async ensureTableExists() {
    try {
      await this.client.send(
        new DescribeTableCommand({ TableName: this.tableName }),
      );
      this.logger.log(`Table "${this.tableName}" exists and is ready.`);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        this.logger.log(`Table "${this.tableName}" not found. Creating...`);
        await this.createNotificationTable();
      } else {
        throw error;
      }
    }
  }

  private async createNotificationTable() {
    const command = new CreateTableCommand({
      TableName: this.tableName,
      AttributeDefinitions: [
        { AttributeName: 'notificationId', AttributeType: 'S' },
        { AttributeName: 'receiverId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'notificationId', KeyType: 'HASH' }, // Partition Key
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'receiverId-timestamp-index',
          KeySchema: [
            { AttributeName: 'receiverId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' },
          ],
          Projection: {
            ProjectionType: 'ALL',
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    });

    try {
      await this.client.send(command);
      this.logger.log(`Table "${this.tableName}" created successfully.`);
    } catch (error) {
      this.logger.error('Failed to create DynamoDB table', error);
      throw error;
    }
  }
}
