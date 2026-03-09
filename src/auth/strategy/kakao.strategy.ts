import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { Inject, Injectable } from '@nestjs/common';
import kakaoConfig from 'src/config/strategy/kakao.config';
import { ConfigType } from '@nestjs/config';
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
  constructor(
    @Inject(kakaoConfig.KEY)
    private readonly kakaoOAuthConfig: ConfigType<typeof kakaoConfig>,
  ) {
    super({
      clientID: kakaoOAuthConfig.clientID,
      clientSecret: kakaoOAuthConfig.clientSecret,
      callbackURL: kakaoOAuthConfig.callbackURL,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: (err: any, user?: any, info?: any) => void,
  ): any {
    const kakaoProfile = profile as KakaoProfile;
    const user: OAuthUser = {
      provider: 'kakao',
      email: kakaoProfile._json.kakao_account.email,
    };
    done(null, user);
  }
}
