import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import {
  TypingCandidate,
  TypingSession,
  TypingTrial,
  TypingPassage,
  TypingConfig,
} from './entities';
import {
  CreateCandidateDto,
  CreateSessionDto,
  SaveTrialDto,
  CreatePassageDto,
  UpdatePassageDto,
  UpdateConfigDto,
} from './dto';
import { normalizeArabic } from './utils/typing.utils';

@Injectable()
export class TypingService {
  constructor(
    @InjectRepository(TypingCandidate)
    private candidateRepo: Repository<TypingCandidate>,
    @InjectRepository(TypingSession)
    private sessionRepo: Repository<TypingSession>,
    @InjectRepository(TypingTrial)
    private trialRepo: Repository<TypingTrial>,
    @InjectRepository(TypingPassage)
    private passageRepo: Repository<TypingPassage>,
    @InjectRepository(TypingConfig)
    private configRepo: Repository<TypingConfig>,
  ) {}

  // ── Candidates ──

  async createCandidate(dto: CreateCandidateDto): Promise<TypingCandidate> {
    // Check for existing candidate by phone OR national ID
    let existing = await this.candidateRepo.findOne({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (!existing && dto.nationalId) {
      existing = await this.candidateRepo.findOne({
        where: { nationalId: dto.nationalId },
      });
    }
    if (existing) {
      // Update name/nationalId if candidate already exists
      existing.fullName = dto.fullName;
      if (dto.nationalId) existing.nationalId = dto.nationalId;
      return this.candidateRepo.save(existing);
    }
    const candidate = this.candidateRepo.create(dto);
    return this.candidateRepo.save(candidate);
  }

  async searchCandidates(search: string): Promise<TypingCandidate[]> {
    return this.candidateRepo.find({
      where: [
        { fullName: ILike(`%${search}%`) },
        { phoneNumber: ILike(`%${search}%`) },
        { nationalId: ILike(`%${search}%`) },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findCandidateByPhone(phone: string): Promise<TypingCandidate | null> {
    return this.candidateRepo.findOne({ where: { phoneNumber: phone } });
  }

  // ── Sessions ──

  async createSession(dto: CreateSessionDto): Promise<TypingSession> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: dto.candidateId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const config = await this.getConfig();
    const session = this.sessionRepo.create({
      candidateId: dto.candidateId,
      configSnapshot: {
        trialDurationSeconds: config.trialDurationSeconds,
        trialsPerLanguage: config.trialsPerLanguage,
        showLiveWpm: config.showLiveWpm,
        enableSoundEffects: config.enableSoundEffects,
        voidOnTabSwitch: config.voidOnTabSwitch,
      },
    });
    return this.sessionRepo.save(session);
  }

  async getSession(id: string): Promise<TypingSession> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['candidate', 'trials'],
      order: { trials: { language: 'ASC', trialNumber: 'ASC' } },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async saveTrial(sessionId: string, dto: SaveTrialDto): Promise<TypingTrial> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'completed')
      throw new BadRequestException('Session already completed');

    const trial = this.trialRepo.create({
      sessionId,
      ...dto,
    });
    return this.trialRepo.save(trial);
  }

  async completeSession(id: string): Promise<TypingSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    session.status = 'completed';
    session.completedAt = new Date();
    return this.sessionRepo.save(session);
  }

  // ── Passages ──

  async getPassages(language?: string): Promise<TypingPassage[]> {
    const where: any = {};
    if (language) where.language = language;
    return this.passageRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getActivePassages(language: string): Promise<TypingPassage[]> {
    return this.passageRepo.find({
      where: { language, isActive: true },
      order: { id: 'ASC' },
    });
  }

  async getRandomPassages(
    language: string,
    count: number,
  ): Promise<TypingPassage[]> {
    const active = await this.getActivePassages(language);
    if (active.length < count) {
      throw new BadRequestException(
        `Not enough active ${language} passages. Need ${count}, have ${active.length}.`,
      );
    }
    // Fisher-Yates shuffle and pick first N
    const shuffled = [...active];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  async createPassage(dto: CreatePassageDto): Promise<TypingPassage> {
    let content = dto.content.trim();
    if (dto.language === 'ar') {
      content = normalizeArabic(content);
    }
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    const passage = this.passageRepo.create({
      language: dto.language,
      content,
      wordCount,
    });
    return this.passageRepo.save(passage);
  }

  async updatePassage(
    id: number,
    dto: UpdatePassageDto,
  ): Promise<TypingPassage> {
    const passage = await this.passageRepo.findOne({ where: { id } });
    if (!passage) throw new NotFoundException('Passage not found');

    if (dto.content !== undefined) {
      passage.content =
        passage.language === 'ar'
          ? normalizeArabic(dto.content.trim())
          : dto.content.trim();
      passage.wordCount = passage.content
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
    }
    if (dto.isActive !== undefined) {
      passage.isActive = dto.isActive;
    }
    return this.passageRepo.save(passage);
  }

  async togglePassage(id: number): Promise<TypingPassage> {
    const passage = await this.passageRepo.findOne({ where: { id } });
    if (!passage) throw new NotFoundException('Passage not found');
    passage.isActive = !passage.isActive;
    return this.passageRepo.save(passage);
  }

  async deletePassage(id: number): Promise<void> {
    const result = await this.passageRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Passage not found');
  }

  // ── Config ──

  async getConfig(): Promise<TypingConfig> {
    let config = await this.configRepo.findOne({ where: { id: 1 } });
    if (!config) {
      config = this.configRepo.create({ id: 1 });
      await this.configRepo.save(config);
    }
    return config;
  }

  async updateConfig(dto: UpdateConfigDto): Promise<TypingConfig> {
    let config = await this.getConfig();
    Object.assign(config, dto);
    return this.configRepo.save(config);
  }

  // ── Admin ──

  async getAllResults(query: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.candidate', 'c')
      .leftJoinAndSelect('s.trials', 't')
      .where('s.status = :status', { status: 'completed' })
      .orderBy('s.completedAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.search) {
      qb.andWhere(
        '(c.full_name ILIKE :search OR c.phone_number ILIKE :search OR c.national_id ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [sessions, total] = await qb.getManyAndCount();

    const data = sessions.map((s) => {
      const enTrials = s.trials
        .filter((t) => t.language === 'en')
        .sort((a, b) => a.trialNumber - b.trialNumber);
      const arTrials = s.trials
        .filter((t) => t.language === 'ar')
        .sort((a, b) => a.trialNumber - b.trialNumber);

      const avgEn =
        enTrials.length > 0
          ? Math.round(
              enTrials.reduce((sum, t) => sum + t.netWpm, 0) / enTrials.length,
            )
          : 0;
      const avgAr =
        arTrials.length > 0
          ? Math.round(
              arTrials.reduce((sum, t) => sum + t.netWpm, 0) / arTrials.length,
            )
          : 0;
      const avgAccEn =
        enTrials.length > 0
          ? Math.round(
              enTrials.reduce((sum, t) => sum + t.accuracy, 0) /
                enTrials.length,
            )
          : 0;
      const avgAccAr =
        arTrials.length > 0
          ? Math.round(
              arTrials.reduce((sum, t) => sum + t.accuracy, 0) /
                arTrials.length,
            )
          : 0;

      return {
        sessionId: s.id,
        candidateName: s.candidate.fullName,
        phoneNumber: s.candidate.phoneNumber,
        nationalId: s.candidate.nationalId,
        completedAt: s.completedAt,
        avgEnWpm: avgEn,
        avgArWpm: avgAr,
        avgEnAccuracy: avgAccEn,
        avgArAccuracy: avgAccAr,
        enTrials,
        arTrials,
      };
    });

    return { data, total };
  }

  async getStats(): Promise<any> {
    const totalCandidates = await this.candidateRepo.count();
    const totalSessions = await this.sessionRepo.count({
      where: { status: 'completed' },
    });

    const avgStats = await this.trialRepo
      .createQueryBuilder('t')
      .select('t.language', 'language')
      .addSelect('ROUND(AVG(t.net_wpm))', 'avgWpm')
      .addSelect('ROUND(AVG(t.accuracy))', 'avgAccuracy')
      .innerJoin('t.session', 's')
      .where('s.status = :status', { status: 'completed' })
      .groupBy('t.language')
      .getRawMany();

    return {
      totalCandidates,
      totalSessions,
      avgByLanguage: avgStats,
    };
  }

  async exportCsv(): Promise<string> {
    const sessions = await this.sessionRepo.find({
      where: { status: 'completed' },
      relations: ['candidate', 'trials'],
      order: { completedAt: 'DESC' },
    });

    const headers = [
      'Name',
      'Phone',
      'National ID',
      'Date',
      'Language',
      'Trial',
      'Net WPM',
      'Gross WPM',
      'Accuracy %',
      'Correct Words',
      'Total Words',
      'Errors',
      'Duration (s)',
      'Tab Switches',
    ];

    const rows = sessions.flatMap((s) =>
      s.trials
        .sort(
          (a, b) =>
            a.language.localeCompare(b.language) ||
            a.trialNumber - b.trialNumber,
        )
        .map((t) =>
          [
            `"${s.candidate.fullName}"`,
            s.candidate.phoneNumber,
            s.candidate.nationalId || '',
            s.completedAt ? s.completedAt.toISOString().split('T')[0] : '',
            t.language.toUpperCase(),
            t.trialNumber,
            t.netWpm,
            t.grossWpm,
            t.accuracy,
            t.correctWords,
            t.totalWordsAttempted,
            t.errorCount,
            t.testDuration,
            t.tabSwitches,
          ].join(','),
        ),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  // ── Seed ──

  async seedPassages(): Promise<void> {
    const count = await this.passageRepo.count();
    if (count > 0) return; // Already seeded

    const passages = [
      // English passages from v0.7
      { language: 'en', content: 'the quick brown fox jumps over the lazy dog easily' },
      { language: 'en', content: 'learning to code is like learning a new language' },
      { language: 'en', content: 'coffee is a popular drink enjoyed by millions every day' },
      { language: 'en', content: 'listening to music can improve your mood and focus' },
      { language: 'en', content: 'reading books expands your mind and vocabulary greatly' },
      { language: 'en', content: 'technology evolves faster than we can fully understand it' },
      { language: 'en', content: 'traveling allows you to experience different cultures and foods' },
      { language: 'en', content: 'consistent practice is the only true secret to success' },
      { language: 'en', content: 'drinking enough water is essential for your daily health' },
      { language: 'en', content: 'the internet connects people from all around the world' },
      { language: 'en', content: 'typing fast requires muscle memory and relaxed fingers' },
      { language: 'en', content: 'nature has a way of healing the human spirit completely' },
      { language: 'en', content: 'artificial intelligence will change the future of work' },
      { language: 'en', content: 'taking small breaks during work increases productivity' },
      { language: 'en', content: 'a good night of sleep is vital for mental clarity' },
      // Arabic passages from v0.7 (already normalized)
      { language: 'ar', content: 'الماء ضروري لبقاء الكايناة الحية على قيد الحياة' },
      { language: 'ar', content: 'السماء صافية والجو جميل في هذا المساء' },
      { language: 'ar', content: 'القهوة مشروب مفضل لدي الكثيرين في الصباح الباكر' },
      { language: 'ar', content: 'الرياضة تساعد على تحسين الصحة النفسية والجسدية' },
      { language: 'ar', content: 'الهواء النقي يعطي طاقة ايجابية ونشاطا للجسم' },
      { language: 'ar', content: 'القراءة توسع المدارك وتنمي الخيال لدي الاطفال' },
      { language: 'ar', content: 'العمل الجماعي يحقق نتايج افضل بكثير من الفردي' },
      { language: 'ar', content: 'البرمجة لغة العصر وتفتح ابوابا كثيرة للمستقبل' },
      { language: 'ar', content: 'التكنولوجيا الحديثة جعلت التواصل بين الناس اسهل' },
      { language: 'ar', content: 'شرب الماء بكثرة ضروري للحفاظ على نشاط الجسم' },
      { language: 'ar', content: 'النوم المبكر يساعد على التركيز خلال ساعات النهار' },
      { language: 'ar', content: 'الاستماع للموسيقي الهادية يقلل من التوتر اليومي' },
      { language: 'ar', content: 'النجاح يتطلب الصبر والاستمرارية في بذل الجهد' },
      { language: 'ar', content: 'الذكاء الاصطناعي يطور مجالات الطب والهندسة بسرعة' },
      { language: 'ar', content: 'تعلم لغة جديدة ينشط العقل ويحسن الذاكرة' },
    ];

    for (const p of passages) {
      const content =
        p.language === 'ar' ? normalizeArabic(p.content) : p.content;
      const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
      await this.passageRepo.save(
        this.passageRepo.create({ ...p, content, wordCount }),
      );
    }

    // Seed default config
    await this.getConfig();
  }
}
