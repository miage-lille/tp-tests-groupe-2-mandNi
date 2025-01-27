import { PrismaClient } from '@prisma/client';
import {
    PostgreSqlContainer,
    StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { exec } from 'child_process';
import { PrismaWebinarRepository } from 'src/webinars/adapters/webinar-repository.prisma';
import { Webinar } from 'src/webinars/entities/webinar.entity';
import { promisify } from 'util';

const asyncExec = promisify(exec);

describe('PrismaWebinarRepository', () => {
    let container: StartedPostgreSqlContainer;
    let prismaClient: PrismaClient;
    let repository: PrismaWebinarRepository;

    beforeAll(async () => {
        container = await new PostgreSqlContainer()
            .withDatabase('test_db')
            .withUsername('user_test')
            .withPassword('password_test')
            .withExposedPorts(5432)
            .start();

        const dbUrl = container.getConnectionUri();
        prismaClient = new PrismaClient({
            datasources: {
                db: { url: dbUrl },
            },
        });

        await asyncExec(`DATABASE_URL=${dbUrl} npx prisma migrate deploy`);

        return prismaClient.$connect();
    });

    beforeEach(async () => {
        repository = new PrismaWebinarRepository(prismaClient);
        await prismaClient.webinar.deleteMany();
        await prismaClient.$executeRawUnsafe('DELETE FROM "Webinar" CASCADE');
    });

    afterAll(async () => {
        await container.stop({ timeout: 1000 });
        return prismaClient.$disconnect();
    });

    describe('Scenario: repository.create', () => {
        it('should create a webinar', async () => {
            // ARRANGE
            const webinar = new Webinar({
                id: 'webinar-id',
                organizerId: 'organizer-id',
                title: 'Webinar title',
                startDate: new Date('2022-01-01T00:00:00Z'),
                endDate: new Date('2022-01-01T01:00:00Z'),
                seats: 100,
            });

            // ACT
            await repository.create(webinar);

            // ASSERT
            const maybeWebinar = await prismaClient.webinar.findUnique({
                where: { id: 'webinar-id' },
            });

            expect(maybeWebinar).toEqual({
                id: 'webinar-id',
                organizerId: 'organizer-id',
                title: 'Webinar title',
                startDate: new Date('2022-01-01T00:00:00Z'),
                endDate: new Date('2022-01-01T01:00:00Z'),
                seats: 100,
            });
        });
    });

    describe('Scenario: repository.findById', () => {
        it('should return the correct webinar when found', async () => {
            // ARRANGE
            await prismaClient.webinar.create({
                data: {
                    id: 'webinar-id',
                    organizerId: 'organizer-id',
                    title: 'Webinar title',
                    startDate: new Date('2022-01-01T00:00:00Z'),
                    endDate: new Date('2022-01-01T01:00:00Z'),
                    seats: 100,
                },
            });

            // ACT
            const webinar = await repository.findById('webinar-id');

            // ASSERT
            expect(webinar).not.toBeNull();
            expect(webinar?.props.id).toBe('webinar-id');
            expect(webinar?.props.title).toBe('Webinar title');
        });

        it('should return null if webinar does not exist', async () => {
            // ACT
            const webinar = await repository.findById('non-existent-id');

            // ASSERT
            expect(webinar).toBeNull();
        });
    });

    describe('Scenario: repository.update', () => {
        it('should update webinar seats', async () => {
            // ARRANGE
            await prismaClient.webinar.create({
                data: {
                    id: 'webinar-id',
                    organizerId: 'organizer-id',
                    title: 'Webinar title',
                    startDate: new Date('2022-01-01T00:00:00Z'),
                    endDate: new Date('2022-01-01T01:00:00Z'),
                    seats: 100,
                },
            });

            const webinar = new Webinar({
                id: 'webinar-id',
                organizerId: 'organizer-id',
                title: 'Updated Webinar Title',
                startDate: new Date('2022-01-01T00:00:00Z'),
                endDate: new Date('2022-01-01T01:00:00Z'),
                seats: 200,
            });

            // ACT
            await repository.update(webinar);

            // ASSERT
            const updatedWebinar = await prismaClient.webinar.findUnique({
                where: { id: 'webinar-id' },
            });

            expect(updatedWebinar?.title).toBe('Updated Webinar Title');
            expect(updatedWebinar?.seats).toBe(200);
        });
    });
});