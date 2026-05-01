import { HttpStatus } from '@nestjs/common';

export class AuthResponseDto {
  accessToken?: string;
  refreshToken?: string;
  socialEmail?: string;
  socialToken?: string;
  status: HttpStatus;
}
