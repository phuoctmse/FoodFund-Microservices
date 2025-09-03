import { Injectable } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"

@Injectable()
export abstract class BaseRepository<T = any> {
    constructor(protected readonly prisma: PrismaClient) {}

  abstract getModelName(): string;

  protected getModel() {
      const modelName = this.getModelName()
      return (this.prisma as any)[modelName]
  }

  async findById(id: string, include?: any): Promise<T | null> {
      return this.getModel().findUnique({
          where: { id },
          include,
      })
  }

  async findMany(
      options: {
      where?: any;
      include?: any;
      orderBy?: any;
      skip?: number;
      take?: number;
    } = {},
  ): Promise<T[]> {
      return this.getModel().findMany(options)
  }

  async create(data: any, include?: any): Promise<T> {
      return this.getModel().create({
          data,
          include,
      })
  }

  async update(id: string, data: any, include?: any): Promise<T> {
      return this.getModel().update({
          where: { id },
          data,
          include,
      })
  }

  async delete(id: string): Promise<T> {
      return this.getModel().delete({
          where: { id },
      })
  }

  async count(where?: any): Promise<number> {
      return this.getModel().count({ where })
  }

  async exists(where: any): Promise<boolean> {
      const count = await this.getModel().count({ where })
      return count > 0
  }
}
