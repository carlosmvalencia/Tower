import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { HealthController } from './health.controller';

const staticModules =
  // Solo servimos /uploads localmente. En producción (gcs) los archivos van por signed URL.
  (process.env.STORAGE_BACKEND ?? 'local') === 'local'
    ? [
        ServeStaticModule.forRoot({
          rootPath: join(process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads')),
          serveRoot: '/uploads',
        }),
      ]
    : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...staticModules,
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
