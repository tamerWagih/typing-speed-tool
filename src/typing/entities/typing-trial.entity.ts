import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TypingSession } from './typing-session.entity';
import { TypingPassage } from './typing-passage.entity';

@Entity('typing_trials')
@Unique(['sessionId', 'language', 'trialNumber'])
export class TypingTrial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ length: 2 })
  language: string;

  @Column({ name: 'trial_number', type: 'smallint' })
  trialNumber: number;

  @Column({ name: 'gross_wpm' })
  grossWpm: number;

  @Column({ name: 'net_wpm' })
  netWpm: number;

  @Column()
  accuracy: number;

  @Column({ name: 'correct_words' })
  correctWords: number;

  @Column({ name: 'total_words_attempted' })
  totalWordsAttempted: number;

  @Column({ name: 'error_count' })
  errorCount: number;

  @Column({ name: 'test_duration' })
  testDuration: number;

  @Column({ name: 'passage_id', nullable: true })
  passageId: number;

  @Column({ name: 'tab_switches', default: 0 })
  tabSwitches: number;

  @Column({ name: 'was_voided', default: false })
  wasVoided: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => TypingSession, (session) => session.trials)
  @JoinColumn({ name: 'session_id' })
  session: TypingSession;

  @ManyToOne(() => TypingPassage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'passage_id' })
  passage: TypingPassage;
}
