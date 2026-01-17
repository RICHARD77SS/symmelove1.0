// apps/api/src/modules/profiles/profiles.controller.ts

import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('v1/profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly service: ProfilesService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  create(@CurrentUser() user: any, @Body() dto: CreateProfileDto) {
    // 🛡️ Extração resiliente do ID do usuário
    const userId = user.id || user.userId || user.sub;
    return this.service.createProfile(userId, dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    const userId = user.id || user.userId || user.sub;
    return this.service.getMyProfile(userId);
  }

  @Patch('me')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const userId = user.id || user.userId || user.sub;
    return this.service.updateMyProfile(userId, dto);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: any) {
    const userId = user.id || user.userId || user.sub;
    return this.service.deleteMyProfile(userId);
  }
}
