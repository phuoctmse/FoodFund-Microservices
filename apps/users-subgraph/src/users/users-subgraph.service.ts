import { Injectable } from '@nestjs/common';
import { User } from './models/user.model';

@Injectable()
export class UsersSubgraphService {
  private users: User[] = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Richard Roe' },
  ];

  findById(id: number): User {
    const user = this.users.find((user) => user.id === Number(id));
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }
}
