import { Injectable, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../modules/user/user.service';
import { UserRow } from '../modules/user/entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload';
import { RedisService } from '../providers/redis/redis.service';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { nanoid } from 'nanoid';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {}

  async validateToken(token: string): Promise<JwtPayload> {
    const secret = this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET');
    return await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret,
    });
  }

  async validateUserById(userId: string): Promise<UserRow | null> {
    return await this.userService.findByPublicId(userId);
  }

  async login(user: UserRow) {
    const payload: JwtPayload = { sub: user.public_id };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async processOAuthLogin(oauthUser: OAuthUser): Promise<AuthResponseDto> {
    // 1. Check if user exists in DB
    const user = await this.userService.findByEmailAndProvider(
      oauthUser.email,
      oauthUser.provider,
    );

    if (user) {
      // Flow A: Login (Status 200)
      const { accessToken } = await this.login(user);
      return {
        accessToken,
        socialToken: 'not-needed-for-login',
        status: HttpStatus.OK,
      };
    } else {
      // Flow B: Signup Handover (Status 201)
      const handoverToken = await this.createHandoverToken(oauthUser);
      return {
        socialEmail: oauthUser.email,
        socialToken: handoverToken,
        status: HttpStatus.CREATED,
      };
    }
  }

  private async createHandoverToken(oauthUser: OAuthUser): Promise<string> {
    const handoverToken = nanoid(21);
    // Store user data with 15 minutes TTL
    await this.redisService.set(
      `auth_handover:${handoverToken}`,
      oauthUser,
      900,
    );
    return handoverToken;
  }
}
