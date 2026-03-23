import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  Header,
  OnModuleInit,
} from '@nestjs/common';
import type { Response } from 'express';
import { TypingService } from './typing.service';
import {
  CreateCandidateDto,
  CreateSessionDto,
  SaveTrialDto,
  CreatePassageDto,
  UpdatePassageDto,
  UpdateConfigDto,
} from './dto';

@Controller('api/typing')
export class TypingController implements OnModuleInit {
  constructor(private readonly typingService: TypingService) {}

  async onModuleInit() {
    await this.typingService.seedPassages();
  }

  // ── Candidates ──

  @Post('candidates')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.typingService.createCandidate(dto);
  }

  @Get('candidates')
  searchCandidates(@Query('search') search: string) {
    if (!search) return [];
    return this.typingService.searchCandidates(search);
  }

  @Get('candidates/by-phone')
  findByPhone(@Query('phone') phone: string) {
    return this.typingService.findCandidateByPhone(phone);
  }

  // ── Sessions ──

  @Post('sessions')
  createSession(@Body() dto: CreateSessionDto) {
    return this.typingService.createSession(dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.typingService.getSession(id);
  }

  @Post('sessions/:id/trials')
  saveTrial(@Param('id') id: string, @Body() dto: SaveTrialDto) {
    return this.typingService.saveTrial(id, dto);
  }

  @Patch('sessions/:id/complete')
  completeSession(@Param('id') id: string) {
    return this.typingService.completeSession(id);
  }

  @Get('sessions/:id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const session = await this.typingService.getSession(id);
    const { generateSessionPdf } = await import('./pdf.service');
    const doc = generateSessionPdf(session);

    const safeName = session.candidate.fullName.replace(/[^a-zA-Z0-9\u0600-\u06FF ]/g, '').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Typing_Report_${safeName}.pdf"`);
    doc.pipe(res);
    doc.end();
  }

  // ── Config ──

  @Get('config')
  getConfig() {
    return this.typingService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.typingService.updateConfig(dto);
  }

  // ── Passages ──

  @Get('passages')
  getPassages(@Query('lang') lang?: string) {
    return this.typingService.getPassages(lang);
  }

  @Get('passages/random')
  getRandomPassages(
    @Query('lang') lang: string,
    @Query('count') count: string,
  ) {
    return this.typingService.getRandomPassages(
      lang,
      parseInt(count) || 3,
    );
  }

  @Post('passages')
  createPassage(@Body() dto: CreatePassageDto) {
    return this.typingService.createPassage(dto);
  }

  @Put('passages/:id')
  updatePassage(@Param('id') id: string, @Body() dto: UpdatePassageDto) {
    return this.typingService.updatePassage(parseInt(id), dto);
  }

  @Patch('passages/:id/toggle')
  togglePassage(@Param('id') id: string) {
    return this.typingService.togglePassage(parseInt(id));
  }

  @Delete('passages/:id')
  deletePassage(@Param('id') id: string) {
    return this.typingService.deletePassage(parseInt(id));
  }

  // ── Admin ──

  @Get('admin/results')
  getAllResults(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.typingService.getAllResults({
      search,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10),
    });
  }

  @Get('admin/results/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=typing-results.csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.typingService.exportCsv();
    res.send(csv);
  }

  @Get('admin/stats')
  getStats() {
    return this.typingService.getStats();
  }

  @Post('admin/reset-passages')
  resetPassages() {
    return this.typingService.resetPassages();
  }

  @Post('admin/reset-config')
  resetConfig() {
    return this.typingService.resetConfig();
  }
}
