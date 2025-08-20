import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolverResolver } from './users-resolver.resolver';

describe('UsersResolverResolver', () => {
  let resolver: UsersResolverResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersResolverResolver],
    }).compile();

    resolver = module.get<UsersResolverResolver>(UsersResolverResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
