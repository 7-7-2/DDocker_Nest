import {
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleAuthGuard } from './guard/google-auth.guard';
import { KakaoAuthGuard } from './guard/kakao-auth.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { JwtRefreshGuard } from './guard/jwt-refresh.guard';
import { AuthService } from './auth.service';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GetUser } from './decorators/get-user.decorator';
import { UserRow } from '../modules/user/entities/user.entity';

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

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    if (authResult.status === HttpStatus.OK && authResult.refreshToken) {
      this.setRefreshTokenCookie(res, authResult.refreshToken);
    }

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

  @Get('kakao/callback')
  @UseGuards(KakaoAuthGuard)
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    const oauthUser = req.user as OAuthUser;
    const authResult = await this.authService.processOAuthLogin(oauthUser);

    if (authResult.status === HttpStatus.OK && authResult.refreshToken) {
      this.setRefreshTokenCookie(res, authResult.refreshToken);
    }

    const redirectUrl = this.authService.buildFrontendRedirectUrl(authResult);
    return res.redirect(redirectUrl);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Access Token using Refresh Token' })
  async refresh(
    @GetUser() user: UserRow & { refreshToken: string },
    @Res() res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.refresh(
      user,
      user.refreshToken,
    );

    this.setRefreshTokenCookie(res, refreshToken);
    return res.send({ accessToken: `Bearer ${accessToken}` });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  async logout(@GetUser('public_id') userId: string, @Res() res: Response) {
    await this.authService.logout(userId);
    res.clearCookie('refreshToken', this.getCookieOptions());
    return res.send({ message: 'Logged out successfully' });
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, this.getCookieOptions());
  }

  private getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    };
  }
}
