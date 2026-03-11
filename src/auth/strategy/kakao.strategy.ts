import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthUser } from '../interfaces/oauth-user.interface';

interface KakaoProfile {
  id: number;
  _json: {
    kakao_account: {
      email: string;
    };
    properties: {
      nickname: string;
      profile_image: string;
    };
  };
}

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('KAKAO_CLIENT_ID'),
      clientSecret: '', // Kakao often doesn't require this for certain flows, but passing empty string
      callbackURL: configService.getOrThrow<string>('KAKAO_REDIRECT_URI'),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any, info?: any) => void,
  ): void {
    const kakaoProfile = profile as KakaoProfile;
    const user: OAuthUser = {
      provider: 'kakao',
      email: kakaoProfile._json.kakao_account.email,
    };
    done(null, user);
  }
}
