import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guard/google-auth.guard';
import { KakaoAuthGuard } from './guard/kakao-auth.guard';
import { AuthService } from './auth.service';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google/url')
  @ApiOperation({ summary: 'Get Google OAuth URL for manual redirect' })
  getGoogleUrl() {
    const clientID = this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const callbackURL = this.configService.getOrThrow<string>(
      'GOOGLE_CALLBACK_URL',
    );
    const scope = ['email', 'profile'].join(' ');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${callbackURL}&response_type=code&scope=${scope}`;
    return { url };
  }

  // @Get('google')
  // @UseGuards(GoogleAuthGuard)
  // @ApiOperation({ summary: 'Login with Google (Redirect handled by Passport)' })
  // async googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    const redirectUrl = this.authService.buildFrontendRedirectUrl(authResult);
    return res.redirect(redirectUrl);
  }

  @Get('kakao/url')
  @ApiOperation({ summary: 'Get Kakao OAuth URL for manual redirect' })
  getKakaoUrl() {
    const clientID = this.configService.getOrThrow<string>('KAKAO_CLIENT_ID');
    const callbackURL =
      this.configService.getOrThrow<string>('KAKAO_CALLBACK_URL');
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${clientID}&redirect_uri=${callbackURL}&response_type=code`;
    return { url };
  }

  // @Get('kakao')
  // @UseGuards(KakaoAuthGuard)
  // @ApiOperation({ summary: 'Login with Kakao (Redirect handled by Passport)' })
  // async kakaoLogin() {}

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    const redirectUrl = this.authService.buildFrontendRedirectUrl(authResult);
    return res.redirect(redirectUrl);
  }
}
