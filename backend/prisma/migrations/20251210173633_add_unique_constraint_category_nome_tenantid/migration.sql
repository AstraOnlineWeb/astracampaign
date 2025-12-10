-- CreateUniqueIndex
-- Adiciona constraint única composta para prevenir categorias duplicadas por tenant
-- Nota: NULLs são permitidos múltiplas vezes em constraints únicas no PostgreSQL
CREATE UNIQUE INDEX "categories_nome_tenant_id_key" ON "categories"("nome", "tenant_id");
