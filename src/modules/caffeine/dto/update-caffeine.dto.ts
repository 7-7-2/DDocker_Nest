import { PartialType } from '@nestjs/mapped-types';
import { CreateCaffeineDto } from './create-caffeine.dto';

export class UpdateCaffeineDto extends PartialType(CreateCaffeineDto) {}
