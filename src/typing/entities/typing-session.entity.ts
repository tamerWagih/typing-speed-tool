import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { TypingCandidate } from './typing-candidate.entity';
import { TypingTrial } from './typing-trial.entity';

@Entity('typing_sessions')
export class TypingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_id' })
  candidateId: string;

  @Column({ length: 20, default: 'in_progress' })
  status: string;

  @Column({ name: 'config_snapshot', type: 'jsonb', nullable: true })
  configSnapshot: any;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;

  @ManyToOne(() => TypingCandidate, (candidate) => candidate.sessions)
  @JoinColumn({ name: 'candidate_id' })
  candidate: TypingCandidate;

  @OneToMany(() => TypingTrial, (trial) => trial.session)
  trials: TypingTrial[];
}
