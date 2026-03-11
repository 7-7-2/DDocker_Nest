import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateCaffeineDto } from './dto/create-caffeine.dto';
import { CaffeineRepository } from './caffeine.repository';

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(private readonly caffeineRepository: CaffeineRepository) {}
  //TODO: Must-Cache
  async logIntake(userId: string, dto: CreateCaffeineDto): Promise<number> {
    const queryRunner = await this.caffeineRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Insert the intake record
      const intakeId = await this.caffeineRepository.insertIntake(
        {
          user_id: userId,
          brand_id: dto.brandId,
          caffeine: dto.caffeine,
          size: dto.size,
          shot: dto.shot ?? 0,
          intensity: dto.intensity ?? '기본',
          product_name: dto.productName,
        },
        queryRunner,
      );

      await this.caffeineRepository.updateUserStatsSum(
        userId,
        dto.caffeine,
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Intake ${intakeId} logged successfully for user ${userId}`,
      );

      return intakeId;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to log intake for user ${userId}`, error);
      throw new InternalServerErrorException(
        'Failed to record caffeine intake',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
