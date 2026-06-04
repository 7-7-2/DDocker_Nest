import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { Mock } from '../types';

export const createDynamoDbServiceMock = (): Mock<DynamoDbService> => {
  const send = jest.fn();
  return {
    db: {
      send,
    } as any, // DynamoDB internals are complex, leaving as any here is standard for PutCommand.send
    table: 'Notifications',
  };
};
