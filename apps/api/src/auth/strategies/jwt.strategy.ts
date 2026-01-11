// apps/api/src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Pega do namespace 'auth' que você definiu no registerAs
      secretOrKey: configService.get<string>('auth.jwtAccessSecret'), 
    });
  }

  async validate(payload: any) {
    // Note que no seu payload o ID vem como 'sub'
    return { userId: payload.sub, email: payload.email };
  }
}