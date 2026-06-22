import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsNumber,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({ example: 'Starbucks' })
  @IsNotEmpty()
  brand: number | string;

  @ApiProperty()
  @IsString()
  @MaxLength(45)
  productName: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  caffeine: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  size: string;

  @ApiProperty()
  @IsNumber()
  @IsOptional()
  shot?: number;

  @ApiProperty()
  @IsString()
  @IsOptional()
  intensity?: string;
}

export class RemoveFavoriteDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  id: number;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  brand: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  caffeine: number;

  @ApiProperty()
  size: string;

  @ApiProperty({ required: false })
  shot?: number;

  @ApiProperty({ required: false })
  intensity?: string;

  static fromRow(row: any, brandName?: string): FavoriteResponseDto {
    return {
      id: row.id,
      userId: row.user_id,
      brand: brandName || 'Unknown',
      productName: row.product_name,
      caffeine: row.caffeine,
      size: row.size,
      shot: row.shot,
      intensity: row.intensity,
    };
  }
}
