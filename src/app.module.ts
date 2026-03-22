import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TypingModule } from './typing/typing.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'typing',
      password: process.env.DB_PASS || 'typing123',
      database: process.env.DB_NAME || 'typing_speed',
      autoLoadEntities: true,
      synchronize: true, // Auto-create tables (fine for this project)
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
    }),
    TypingModule,
  ],
})
export class AppModule {}
