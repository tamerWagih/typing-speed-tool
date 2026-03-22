import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { TypingSession } from './typing-session.entity';

@Entity('typing_candidates')
export class TypingCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ name: 'phone_number', length: 20, unique: true })
  phoneNumber: string;

  @Column({ name: 'national_id', length: 20, nullable: true, unique: true })
  nationalId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TypingSession, (session) => session.candidate)
  sessions: TypingSession[];
}
