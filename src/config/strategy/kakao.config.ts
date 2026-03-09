import { registerAs } from '@nestjs/config';

export default registerAs('kakao', () => ({
  clientID: process.env.KAKAO_CLIENT_ID || '',
  clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
  callbackURL: process.env.KAKAO_REDIRECT_URI || '',
}));
