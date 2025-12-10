import { PrismaClient } from '@prisma/client';
import { CategoriesResponse, CategoryInput } from '../types';

const prisma = new PrismaClient();

export class CategoryService {
  static async getCategories(
    search?: string,
    page: number = 1,
    pageSize: number = 10,
    tenantId?: string
  ): Promise<CategoriesResponse> {
    const where: any = {};

    // Apply tenant filter (SUPERADMIN can see all if tenantId is undefined)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    if (search) {
      const searchLower = search.toLowerCase();
      where.OR = [
        {
          nome: {
            contains: searchLower,
            mode: 'insensitive'
          }
        },
        {
          descricao: {
            contains: searchLower,
            mode: 'insensitive'
          }
        }
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy: {
          criadoEm: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.category.count({ where })
    ]);

    return {
      categories,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getCategoryById(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filter (SUPERADMIN can see all if tenantId is undefined)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const category = await prisma.category.findFirst({ where });

    if (!category) {
      throw new Error('Categoria não encontrada');
    }

    return category;
  }

  static async createCategory(data: CategoryInput, tenantId?: string) {
    const newCategory = await prisma.category.create({
      data: {
        nome: data.nome,
        cor: data.cor,
        descricao: data.descricao || null,
        tenantId
      }
    });

    return newCategory;
  }

  static async updateCategory(id: string, data: CategoryInput, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filter (SUPERADMIN can see all if tenantId is undefined)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    // Check if category exists and belongs to tenant
    const existingCategory = await prisma.category.findFirst({ where });

    if (!existingCategory) {
      throw new Error('Categoria não encontrada');
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        nome: data.nome,
        cor: data.cor,
        descricao: data.descricao || null,
      }
    });

    return updatedCategory;
  }

  static async deleteCategory(id: string, tenantId?: string) {
    const where: any = { id };

    // Apply tenant filter (SUPERADMIN can see all if tenantId is undefined)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    // Check if category exists and belongs to tenant
    const existingCategory = await prisma.category.findFirst({ where });

    if (!existingCategory) {
      throw new Error('Categoria não encontrada');
    }

    await prisma.category.delete({
      where: { id }
    });
  }

  static async getAllCategories(tenantId?: string) {
    const where: any = {};

    // Apply tenant filter (SUPERADMIN can see all if tenantId is undefined)
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    return prisma.category.findMany({
      where,
      orderBy: {
        criadoEm: 'desc'
      }
    });
  }

  static async findOrCreateCategoryByName(nome: string, tenantId?: string): Promise<string> {
    if (!nome || !nome.trim()) {
      throw new Error('Nome da categoria é obrigatório');
    }

    const nomeTrimmed = nome.trim();
    const where: any = {
      nome: {
        equals: nomeTrimmed,
        mode: 'insensitive'
      }
    };

    // Apply tenant filter
    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    // Buscar categoria existente (case-insensitive)
    const existingCategory = await prisma.category.findFirst({ where });

    if (existingCategory) {
      return existingCategory.id;
    }

    // Selecionar cor aleatória da lista de cores padrão
    const defaultColors = [
      '#1e3a5f', // Astra Dark Blue
      '#4a9eff', // Astra Light Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#F97316', // Orange
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#EC4899', // Pink
    ];
    const randomColor = defaultColors[Math.floor(Math.random() * defaultColors.length)];

    try {
      // Tentar criar a categoria diretamente
      // A constraint única garante que não haverá duplicatas
      const newCategory = await prisma.category.create({
        data: {
          nome: nomeTrimmed,
          cor: randomColor,
          descricao: null,
          tenantId
        }
      });

      return newCategory.id;
    } catch (error: any) {
      // Se falhar por violação de constraint única (P2002), significa que outra
      // requisição criou a categoria simultaneamente (race condition)
      // Buscar novamente a categoria criada
      if (error.code === 'P2002') {
        const category = await prisma.category.findFirst({ where });
        if (category) {
          return category.id;
        }
        // Se ainda não encontrar, pode ser um problema de case-sensitivity
        // Tentar buscar sem case-insensitive como fallback
        const fallbackWhere: any = { nome: nomeTrimmed };
        if (tenantId !== undefined) {
          fallbackWhere.tenantId = tenantId;
        }
        const fallbackCategory = await prisma.category.findFirst({ where: fallbackWhere });
        if (fallbackCategory) {
          return fallbackCategory.id;
        }
      }
      // Se não for erro de duplicata, relançar o erro
      throw error;
    }
  }
}
