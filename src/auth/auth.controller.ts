import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guard/google-auth.guard';
import { KakaoAuthGuard } from './guard/kakao-auth.guard';
import { AuthService } from './auth.service';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Login with Google' })
  async googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    res.status(authResult.status);
    return {
      accessToken: authResult.accessToken,
      socialEmail: authResult.socialEmail,
      socialToken: authResult.socialToken,
    };
  }

  @Get('kakao')
  @UseGuards(KakaoAuthGuard)
  @ApiOperation({ summary: 'Login with Kakao' })
  async kakaoLogin() {}

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    res.status(authResult.status);
    return {
      accessToken: authResult.accessToken,
      socialEmail: authResult.socialEmail,
      socialToken: authResult.socialToken,
    };
  }
}
