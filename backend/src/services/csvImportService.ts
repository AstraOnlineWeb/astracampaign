import csvParser from 'csv-parser';
import * as fs from 'fs';
import { ContactInput, ImportResult } from '../types';
import { CategoryService } from './categoryService';
import { ContactService } from './contactService';

interface CSVRow {
  nome?: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  tags?: string;
  categoria?: string; // Nome da categoria (não ID)
  categoriaid?: string; // Mantido para compatibilidade
}

export class CSVImportService {
  static async importContacts(filePath: string, tenantId: string): Promise<ImportResult> {
    const results: CSVRow[] = [];
    const errors: string[] = [];
    let successfulImports = 0;
    let failedImports = 0;

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser({
          mapHeaders: ({ header }: { header: string }) => header.toLowerCase().trim()
        }))
        .on('data', (data: CSVRow) => {
          results.push(data);
        })
        .on('end', async () => {
          console.log(`📊 CSVImportService - Processando ${results.length} linhas do CSV para tenantId: ${tenantId}`);

          for (let i = 0; i < results.length; i++) {
            const row = results[i];
            const rowNumber = i + 2; // +2 porque CSV tem header e arrays começam em 0

            console.log(`🔍 Linha ${rowNumber} - Dados parseados:`, JSON.stringify(row));
            console.log(`📋 Headers disponíveis:`, Object.keys(row));

            try {
              // Validar campos obrigatórios
              if (!row.nome || !row.telefone) {
                console.log(`❌ Linha ${rowNumber} - nome: "${row.nome}", telefone: "${row.telefone}"`);
                errors.push(`Linha ${rowNumber}: Nome e telefone são obrigatórios`);
                failedImports++;
                continue;
              }

              // Processar categoria: buscar por nome ou criar se não existir
              let categoriaId: string | undefined = undefined;
              const categoriaNome = row.categoria?.trim() || row.categoriaid?.trim();

              if (categoriaNome) {
                try {
                  categoriaId = await CategoryService.findOrCreateCategoryByName(categoriaNome, tenantId);
                  console.log(`📂 Linha ${rowNumber} - Categoria "${categoriaNome}": ${categoriaId ? 'encontrada/criada' : 'não encontrada'}`);
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Erro ao processar categoria';
                  console.warn(`⚠️ Linha ${rowNumber} - Erro ao processar categoria "${categoriaNome}": ${errorMessage}`);
                  // Continua sem categoria se houver erro
                }
              }

              // Preparar dados do contato incluindo tenantId
              const tags = row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [];
              const contactData: ContactInput = {
                nome: row.nome.trim(),
                telefone: row.telefone.trim(),
                email: row.email?.trim() || undefined,
                observacoes: row.observacoes?.trim() || undefined,
                tags: tags,
                categoriaId: categoriaId,
                tenantId: tenantId
              };

              console.log(`🏷️ Linha ${rowNumber} - Tags extraídas:`, tags);
              console.log(`📂 Linha ${rowNumber} - Categoria: "${categoriaNome}" -> ID: ${categoriaId || 'nenhuma'}`);

              // Criar contato
              await ContactService.createContact(contactData);
              successfulImports++;
              console.log(`✅ Linha ${rowNumber} importada: ${contactData.nome} (tenant: ${tenantId})`);

            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
              errors.push(`Linha ${rowNumber}: ${errorMessage}`);
              failedImports++;
              console.log(`❌ Erro na linha ${rowNumber}: ${errorMessage}`);
            }
          }

          // Limpar arquivo temporário
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn('Erro ao limpar arquivo temporário:', error);
          }

          const result: ImportResult = {
            success: errors.length === 0,
            totalRows: results.length,
            successfulImports,
            failedImports,
            errors
          };

          console.log('📈 Resultado da importação:', result);
          resolve(result);
        })
        .on('error', (error: any) => {
          console.error('❌ Erro ao processar CSV:', error);
          reject(error);
        });
    });
  }
}
