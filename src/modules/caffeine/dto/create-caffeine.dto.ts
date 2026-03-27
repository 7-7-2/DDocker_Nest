import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCaffeineDto {
  @ApiProperty({
    description: 'ID or Name of the coffee brand',
    example: 'Starbucks',
  })
  @IsNotEmpty()
  brandId: number | string;

  @ApiProperty({ description: 'Caffeine amount in mg', example: 317 })
  @IsNumber()
  @IsNotEmpty()
  caffeine: number;

  @ApiProperty({ description: 'Size of the drink', example: 'Regular' })
  @IsString()
  @IsNotEmpty()
  size: string;

  @ApiProperty({ description: 'Number of extra shots', example: 0 })
  @IsNumber()
  @IsOptional()
  shot?: number;

  @ApiProperty({ description: 'Intensity of the drink', example: '기본' })
  @IsString()
  @IsOptional()
  intensity?: string;

  @ApiProperty({
    description: 'Name of the coffee product',
    example: '돌체라떼',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;
}
