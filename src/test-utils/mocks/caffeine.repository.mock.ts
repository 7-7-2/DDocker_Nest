import { CaffeineRepository } from '../../modules/caffeine/caffeine.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createCaffeineRepositoryMock = (): Mock<CaffeineRepository> => ({
  insertIntake: jest.fn(),
  updateUserStatsSum: jest.fn(),
  findTodayConsumption: jest.fn(),
  findMonthlyDetails: jest.fn(),
  softDeleteIntake: jest.fn(),
  findById: jest.fn(),
  findDetailedIntakesInRange: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
