import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('typing_passages')
export class TypingPassage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 2 })
  language: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'word_count' })
  wordCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
