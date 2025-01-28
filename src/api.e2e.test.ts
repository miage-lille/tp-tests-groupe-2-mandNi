import supertest from 'supertest';
import { TestServerFixture } from './tests/fixtures';

describe('Webinar Routes E2E', () => {
    let fixture: TestServerFixture;

    beforeAll(async () => {
        fixture = new TestServerFixture();
        await fixture.init();
    });

    beforeEach(async () => {
        await fixture.reset();
    });

    afterAll(async () => {
        await fixture.stop();
    });

    //
    // ────────────────────────────────────────────────────────────────────────────────
    //   Scenario: Happy path
    // ────────────────────────────────────────────────────────────────────────────────
    //

    it('should update webinar seats', async () => {
        // ARRANGE
        const prisma = fixture.getPrismaClient();
        const server = fixture.getServer();

        const webinar = await prisma.webinar.create({
            data: {
                id: 'test-webinar',
                title: 'Webinar Test',
                seats: 10,
                startDate: new Date(),
                endDate: new Date(),
                organizerId: 'test-user',
            },
        });

        // ACT
        const response = await supertest(server)
            .post(`/webinars/${webinar.id}/seats`)
            .send({ seats: 30 })
            .expect(200);

        // ASSERT
        expect(response.body).toEqual({ message: 'Seats updated' });

        const updatedWebinar = await prisma.webinar.findUnique({
            where: { id: webinar.id },
        });
        expect(updatedWebinar?.seats).toBe(30);
    });

    //
    // ────────────────────────────────────────────────────────────────────────────────
    //   Scenario: WebinarNotFoundException
    // ────────────────────────────────────────────────────────────────────────────────
    //

    it('should return 404 when trying to update a non-existent webinar', async () => {
        const server = fixture.getServer();

        const response = await supertest(server)
            .post('/webinars/non-existent-webinar/seats')
            .send({ seats: 50 })
            .expect(404);

        expect(response.body.error).toContain('Webinar not found');
    });

    //
    // ────────────────────────────────────────────────────────────────────────────────
    //   Scenario: WebinarNotOrganizerException
    // ────────────────────────────────────────────────────────────────────────────────
    //

    it('should return 403 if user is not the organizer', async () => {
        // ARRANGE
        const prisma = fixture.getPrismaClient();
        const server = fixture.getServer();

        await prisma.webinar.create({
            data: {
                id: 'test-webinar',
                title: 'Webinar Test',
                seats: 10,
                startDate: new Date(),
                endDate: new Date(),
                organizerId: 'organizer-1', // Different organizer
            },
        });

        // ACT
        const response = await supertest(server)
            .post(`/webinars/test-webinar/seats`)
            .set('Authorization', 'Bearer test-user-token')
            .send({ seats: 20, organizerId: 'organizer-2' }) // Wrong organizer
            .expect(403);

        // ASSERT
        expect(response.body.error).toContain('User is not allowed to update this webinar');
    });

    //
    // ────────────────────────────────────────────────────────────────────────────────
    //   Bonus: Test for organize-webinar use-case
    // ────────────────────────────────────────────────────────────────────────────────
    //

    it('should create a new webinar', async () => {
        // ARRANGE
        const server = fixture.getServer();
        const payload = {
            id: 'new-webinar',
            title: 'New Webinar',
            seats: 100,
            startDate: new Date().toISOString(),
            endDate: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
            organizerId: 'organizer-1',
        };

        // ACT
        const response = await supertest(server)
            .post('/webinars')
            .send(payload)
            .expect(201);

        // ASSERT
        expect(response.body).toEqual({ message: 'Webinar created' });

        const createdWebinar = await fixture.getPrismaClient().webinar.findUnique({
            where: { id: 'new-webinar' },
        });

        expect(createdWebinar).toMatchObject({
            id: 'new-webinar',
            title: 'New Webinar',
            seats: 100,
        });
    });

    it('should return 400 if webinar creation data is invalid', async () => {
        const server = fixture.getServer();

        const response = await supertest(server)
            .post('/webinars')
            .send({}) // Empty body, invalid data
            .expect(400);

        expect(response.body.error).toContain('Invalid input');
    });
});