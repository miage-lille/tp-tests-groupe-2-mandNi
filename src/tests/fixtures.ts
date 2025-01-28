import { PrismaClient } from '@prisma/client';
import {
    PostgreSqlContainer,
    StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import Fastify, { FastifyInstance } from 'fastify';
import { AppContainer } from 'src/container';
import { webinarRoutes } from 'src/webinars/routes';
import { promisify } from 'util';

const asyncExec = promisify(exec);

export class TestServerFixture {
    private container!: StartedPostgreSqlContainer;
    private prismaClient!: PrismaClient;
    private serverInstance!: FastifyInstance;
    private appContainer!: AppContainer;

    async init() {
        this.container = await new PostgreSqlContainer()
            .withDatabase('test_db')
            .withUsername('user_test')
            .withPassword('password_test')
            .start();

        const dbUrl = this.container.getConnectionUri();

        this.prismaClient = new PrismaClient({
            datasources: {
                db: { url: dbUrl },
            },
        });

        await asyncExec(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);
        await this.prismaClient.$connect();

        // Initialisation des dépendances
        this.appContainer = new AppContainer();
        this.appContainer.init(this.prismaClient);

        // Initialisation du serveur Fastify
        this.serverInstance = Fastify({ logger: false });
        await webinarRoutes(this.serverInstance, this.appContainer);
        await this.serverInstance.ready();
    }

    getPrismaClient() {
        return this.prismaClient;
    }

    getServer() {
        return this.serverInstance.server;
    }

    async stop() {
        try {
            if (this.serverInstance) await this.serverInstance.close();
            if (this.prismaClient) await this.prismaClient.$disconnect();
            if (this.container) await this.container.stop();
        } catch (error) {
            console.error('Error stopping resources:', error);
        }
    }

    async reset() {
        await this.prismaClient.webinar.deleteMany();
        await this.prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
    }
}