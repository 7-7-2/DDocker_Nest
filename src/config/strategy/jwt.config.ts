import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secretOrKey: process.env.JWT_SECRET || '',
}));
