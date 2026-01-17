// apps/api/src/modules/profiles/dto/create-profile.dto.ts

import { IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CoreProfileDto {
  age?: number;
  gender?: string;
  location?: string;
}

export class CreateProfileDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CoreProfileDto)
  core: CoreProfileDto;

  @IsObject()
  @ValidateNested()
  attributes: Record<string, string | number | boolean | string[]>;
}
