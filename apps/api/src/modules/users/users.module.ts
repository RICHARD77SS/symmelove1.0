// apps/api/src/modules/users/users.module.ts

import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';


// =====================================
// USERS MODULE
// =====================================
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
