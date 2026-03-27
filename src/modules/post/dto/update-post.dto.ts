import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsNumber } from 'class-validator';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ example: 'https://r2.dev/new-photo.png', required: false })
  @IsOptional()
  @IsString()
  photo?: string;

  @ApiProperty({
    example: 1,
    description: '0: Private, 1: Public',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  visibility?: number;
}
