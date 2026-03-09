import { registerAs } from '@nestjs/config';

export default registerAs('google', () => ({
  secretOrKey: process.env.JWT_SECRET || '',
}));
