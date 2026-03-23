import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, MaxLength, Matches } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nationalId: string;
}

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  candidateId: string;
}

export class SaveTrialDto {
  @IsString()
  @Matches(/^(en|ar)$/)
  language: string;

  @IsNumber()
  trialNumber: number;

  @IsNumber()
  grossWpm: number;

  @IsNumber()
  netWpm: number;

  @IsNumber()
  accuracy: number;

  @IsNumber()
  correctWords: number;

  @IsNumber()
  totalWordsAttempted: number;

  @IsNumber()
  errorCount: number;

  @IsNumber()
  testDuration: number;

  @IsOptional()
  @IsNumber()
  passageId?: number;

  @IsOptional()
  @IsNumber()
  tabSwitches?: number;

  @IsOptional()
  @IsBoolean()
  wasVoided?: boolean;
}

export class CreatePassageDto {
  @IsString()
  @Matches(/^(en|ar)$/)
  language: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdatePassageDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  isActive?: boolean;
}

export class UpdateConfigDto {
  @IsOptional()
  trialDurationSeconds?: number;

  @IsOptional()
  trialsPerLanguage?: number;

  @IsOptional()
  showLiveWpm?: boolean;

  @IsOptional()
  enableSoundEffects?: boolean;

  @IsOptional()
  voidOnTabSwitch?: boolean;
}
