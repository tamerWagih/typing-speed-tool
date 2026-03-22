import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';

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

  trialNumber: number;
  grossWpm: number;
  netWpm: number;
  accuracy: number;
  correctWords: number;
  totalWordsAttempted: number;
  errorCount: number;
  testDuration: number;
  passageId?: number;
  tabSwitches?: number;
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
