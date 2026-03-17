import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ description: 'The unique public_id for the post (NanoID)' })
  @IsNotEmpty()
  @IsString()
  postId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  brandId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  caffeine: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  productName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  size: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  shot?: number;

  @ApiProperty()
  @IsOptional()
  @IsString()
  intensity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: '0: Private, 1: Public, 2: Mutual' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(2)
  visibility: number;
}
