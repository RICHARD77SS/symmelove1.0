FROM node:20-alpine

# Instala o pnpm globalmente
RUN npm install -g pnpm

WORKDIR /app

# Copia os arquivos de configuração da raiz (essencial para workspaces)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copia os package.json de todos os pacotes/apps para fazer o fetch das dependências
# (Isso otimiza o cache do Docker)
COPY apps/api/package.json ./apps/api/

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN pnpm install --frozen-lockfile

# Copia o restante do código
COPY . .

# Gera o cliente do Prisma
RUN pnpm prisma generate --schema apps/api/prisma/schema.prisma

# AGORA SIM: Executa o build
# Usa o binário do typescript que foi instalado no node_modules da raiz
RUN pnpm install

RUN pnpm prisma generate --schema apps/api/prisma/schema.prisma

RUN pnpm run build
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["node", "apps/api/dist/main"]