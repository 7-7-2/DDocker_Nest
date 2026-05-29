import { ApiProperty } from '@nestjs/swagger';

export class PopularProductDto {
  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 150, description: 'Official base caffeine content' })
  caffeine: number;
}
