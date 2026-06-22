import { Test, TestingModule } from '@nestjs/testing';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { PostRepository } from '../post/post.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createCommentRepositoryMock } from '../../test-utils/mocks/comment.repository.mock';
import { createPostRepositoryMock } from '../../test-utils/mocks/post.repository.mock';
import { RedisService } from '../../providers/redis/redis.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import {
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Mock } from '../../test-utils/types';
import { QueryRunner } from 'typeorm';
import { TransactionManager } from '../../common/database/transaction.manager';
import { createTransactionManagerMock } from '../../test-utils/mocks/transaction.manager.mock';

describe('CommentService', () => {
  let service: CommentService;
  let commentRepository: Mock<CommentRepository>;
  let postRepository: Mock<PostRepository>;
  let eventEmitter: Mock<EventEmitter2>;
  let queryRunner: jest.Mocked<QueryRunner>;
  let txManager: Mock<TransactionManager>;

  beforeEach(async () => {
    const repoMock = createCommentRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;
    txManager = createTransactionManagerMock();

    // Mock txManager.run to use our queryRunner and simulate lifecycle
    txManager.run!.mockImplementation(async (work, options) => {
      await queryRunner.startTransaction();
      try {
        const result = await work(queryRunner);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        if (error instanceof HttpException) {
          throw error;
        }
        throw new InternalServerErrorException(options?.message);
      } finally {
        await queryRunner.release();
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: CommentRepository,
          useValue: repoMock,
        },
        {
          provide: PostRepository,
          useValue: createPostRepositoryMock(),
        },
        {
          provide: TransactionManager,
          useValue: txManager,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);
    commentRepository = module.get(CommentRepository);
    postRepository = module.get(PostRepository);
    eventEmitter = module.get(EventEmitter2);

    commentRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createComment', () => {
    const dto = { postId: 'post-1', content: 'Great post!' };

    it('should throw NotFoundException if post not found', async () => {
      postRepository.findPostDetail!.mockResolvedValue(null as any);
      await expect(
        service.createComment('user-1', 'nick', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create comment and commit transaction', async () => {
      postRepository.findPostDetail!.mockResolvedValue({
        user_id: 'post-owner',
      } as any);

      await service.createComment('user-1', 'nick-1', dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(commentRepository.insertComment).toHaveBeenCalledWith(
        {
          user_id: 'user-1',
          post_id: 'post-1',
          content: 'Great post!',
        },
        queryRunner,
      );
      expect(commentRepository.incrementCommentCount).toHaveBeenCalledWith(
        'post-1',
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'comment.created',
        expect.anything(),
      );
    });
  });

  describe('deleteComment', () => {
    const dto = { commentId: 1, postId: 'post-1' };

    it('should delete comment and commit transaction', async () => {
      await service.deleteComment('user-1', dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(commentRepository.softDeleteComment).toHaveBeenCalledWith(
        1,
        'post-1',
        queryRunner,
      );
      expect(commentRepository.decrementCommentCount).toHaveBeenCalledWith(
        'post-1',
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'comment.deleted',
        expect.anything(),
      );
    });
  });
});
