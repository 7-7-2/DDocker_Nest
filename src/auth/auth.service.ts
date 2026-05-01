import {
  Injectable,
  HttpStatus,
  Inject,
  forwardRef,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../modules/user/user.service';
import { UserRow } from '../modules/user/entities/user.entity';
import { JwtPayload } from './interfaces/jwt-payload';
import { RedisService } from '../providers/redis/redis.service';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { nanoid } from 'nanoid';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ServerConfigName, ServerConfig } from '../config/server.config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly redisService: RedisService,
  ) {}

  async validateToken(token: string): Promise<JwtPayload> {
    const secret = this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET');
    return await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret,
    });
  }

  async login(user: UserRow) {
    const payload: JwtPayload = { sub: user.public_id };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
      expiresIn: '5m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
      expiresIn: '7d',
    });

    // Store refresh token in Redis (7 days TTL)
    await this.redisService.set(
      `refresh_token:${user.public_id}`,
      refreshToken,
      7 * 24 * 60 * 60,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async refresh(user: UserRow, refreshToken: string) {
    const savedToken = await this.redisService.get<string>(
      `refresh_token:${user.public_id}`,
    );

    if (savedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.login(user);
  }

  async logout(userId: string) {
    await this.redisService.del(`refresh_token:${userId}`);
  }

  async processOAuthLogin(oauthUser: OAuthUser): Promise<AuthResponseDto> {
    // 1. Check if user exists in DB
    const user = await this.userService.findByEmailAndProvider(
      oauthUser.email,
      oauthUser.provider,
    );

    if (user) {
      // Flow A: Login (Status 200)
      const { accessToken, refreshToken } = await this.login(user);
      return {
        accessToken,
        refreshToken,
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

  buildFrontendRedirectUrl(authResult: AuthResponseDto): string {
    const serverConfig =
      this.configService.getOrThrow<ServerConfig>(ServerConfigName);
    const baseUrl = `${serverConfig.frontendUrl}`;
    const query = new URLSearchParams();

    if (authResult.status === HttpStatus.OK) {
      query.append('token', `Bearer ${authResult.accessToken!}`);
      query.append('type', 'login');
    } else {
      query.append('socialToken', authResult.socialToken!);
      query.append('socialEmail', authResult.socialEmail!);
      query.append('type', 'signup');
    }

    return `${baseUrl}?${query.toString()}`;
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
