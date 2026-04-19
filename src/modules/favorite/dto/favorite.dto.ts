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
  brandName: number | string;

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
  @ApiProperty({ example: 'Starbucks' })
  @IsNotEmpty()
  brandName: number | string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productName: string;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  brandName: string;

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
}
