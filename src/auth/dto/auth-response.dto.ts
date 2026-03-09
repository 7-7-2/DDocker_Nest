import { HttpStatus } from '@nestjs/common';

export class AuthResponseDto {
  accessToken?: string;
  socialEmail?: string;
  socialToken?: string;
  status: HttpStatus;
}
