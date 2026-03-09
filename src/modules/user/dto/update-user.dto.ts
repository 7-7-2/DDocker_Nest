import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'NewNickname', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  nickname?: string;

  @ApiProperty({ example: 'New bio here...', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio?: string;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsNumber()
  favBrandId?: number;

  @ApiProperty({ example: 'https://r2.dev/new-profile.png', required: false })
  @IsOptional()
  @IsString()
  profileUrl?: string;

  @ApiProperty({
    example: 1,
    description: '0: Public, 1: Private',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  accountPrivacy?: number;
}
