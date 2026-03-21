import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsNumber,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  brandId: number;

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

export class FavoriteResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  brandId: number;

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
