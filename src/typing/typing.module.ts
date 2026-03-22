import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TypingCandidate,
  TypingSession,
  TypingTrial,
  TypingPassage,
  TypingConfig,
} from './entities';
import { TypingService } from './typing.service';
import { TypingController } from './typing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TypingCandidate,
      TypingSession,
      TypingTrial,
      TypingPassage,
      TypingConfig,
    ]),
  ],
  controllers: [TypingController],
  providers: [TypingService],
  exports: [TypingService],
})
export class TypingModule {}
