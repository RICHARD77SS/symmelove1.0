// apps/api/src/modules/profiles/dto/update-profile.dto.ts

import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CoreProfileDto {
  age?: number;
  gender?: string;
  location?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CoreProfileDto)
  core?: CoreProfileDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  attributes?: Record<string, string | number | boolean | string[]>;
}
