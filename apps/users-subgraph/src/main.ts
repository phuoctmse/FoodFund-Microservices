import { NestFactory } from '@nestjs/core';
import { UsersSubgraphModule } from './users/users-subgraph.module';

async function bootstrap() {
  const app = await NestFactory.create(UsersSubgraphModule);
  await app.listen(process.env.port ?? 8001);
}
bootstrap();
