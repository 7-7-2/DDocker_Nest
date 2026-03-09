import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Inject, Injectable } from '@nestjs/common';
import googleConfig from 'src/config/strategy/google.config';
import { ConfigType } from '@nestjs/config';
import { OAuthUser } from '../interfaces/oauth-user.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly googleOAuthConfig: ConfigType<typeof googleConfig>,
  ) {
    super({
      clientID: googleOAuthConfig.clientID,
      clientSecret: googleOAuthConfig.clientSecret,
      callbackURL: googleOAuthConfig.callbackURL,
      scope: googleOAuthConfig.scope,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): any {
    const { emails } = profile;
    const user: OAuthUser = {
      provider: 'google',
      email: emails ? emails[0].value : '',
    };
    done(null, user);
  }
}
