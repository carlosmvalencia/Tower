import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // En producción reducimos verbosidad; en dev mantenemos debug/verbose.
    logger:
      process.env.NODE_ENV === 'production'
        ? ['log', 'warn', 'error']
        : ['log', 'debug', 'warn', 'error', 'verbose'],
  });
  const config = app.get(ConfigService);

  app.use(helmet());

  // CORS: lista separada por comas en CORS_ORIGIN.
  //   dev  → "http://localhost:5173"
  //   prod → "https://all-logistics.co,https://www.all-logistics.co"
  const corsOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger solo en dev (no exponer estructura de API en producción).
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tower API')
      .setDescription('WMS de All-logistics — API REST')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Cloud Run inyecta PORT (default 8080). Bind explícito a 0.0.0.0.
  const port = Number(process.env.PORT ?? config.get('PORT') ?? 3000);
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Tower API listening on :${port} (env=${process.env.NODE_ENV ?? 'development'})`);
  logger.log(`CORS allowed origins: ${corsOrigins.join(', ')}`);
}

bootstrap();
