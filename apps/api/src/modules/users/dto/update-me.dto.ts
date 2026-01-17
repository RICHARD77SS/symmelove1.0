import { 
  IsOptional, 
  IsObject, 
  IsNumber, 
  IsString, 
  IsArray, 
  ValidateNested 
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Sub-DTO para os dados fixos (Core)
 */
class CoreProfileDto {
  @IsOptional()
  @IsNumber()
  age?: number;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

/**
 * Sub-DTO para atributos dinâmicos
 */
class AttributesProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];

  @IsOptional()
  @IsString()
  lifestyle?: string;
}

export class UpdateMeDto {
  /**
   * Dados principais do perfil (JSONB)
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CoreProfileDto) // Necessário para o class-transformer instanciar a classe
  core?: CoreProfileDto;

  /**
   * Dados dinâmicos (JSONB)
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AttributesProfileDto)
  attributes?: AttributesProfileDto;
}