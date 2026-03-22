import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('typing_config')
export class TypingConfig {
  @PrimaryColumn({ default: 1 })
  id: number;

  @Column({ name: 'trial_duration_seconds', default: 60 })
  trialDurationSeconds: number;

  @Column({ name: 'trials_per_language', default: 3 })
  trialsPerLanguage: number;

  @Column({ name: 'show_live_wpm', default: true })
  showLiveWpm: boolean;

  @Column({ name: 'enable_sound_effects', default: true })
  enableSoundEffects: boolean;

  @Column({ name: 'void_on_tab_switch', default: true })
  voidOnTabSwitch: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
