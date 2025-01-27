import { testUser } from "../../users/tests/user-seeds";
import { InMemoryWebinarRepository } from "../adapters/webinar-repository.in-memory";
import { ChangeSeats } from "./change-seats";
import { Webinar } from "../entities/webinar.entity";

describe("Feature: Change seats", () => {
  let webinarRepository: InMemoryWebinarRepository;
  let useCase: ChangeSeats;

  // Constants to reuse
  const WEBINAR_ID = "webinar-id";
  const INITIAL_SEATS = 100;

  // Populate the webinar once
  const webinar = new Webinar({
    id: WEBINAR_ID,
    organizerId: testUser.alice.props.id,
    title: "Webinar title",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-01T01:00:00Z"),
    seats: INITIAL_SEATS,
  });

  // Before each test, reinitialize fresh repository and use-case
  beforeEach(() => {
    webinarRepository = new InMemoryWebinarRepository([webinar]);
    useCase = new ChangeSeats(webinarRepository);
  });


  /**
   * A convenient alias to trigger the use-case from inside each test.
   */
  async function whenUserChangesSeatsWith(payload: {
    user: any;
    webinarId: string;
    seats: number;
  }) {
    return useCase.execute(payload);
  }

  /**
   * Assert that the seats for the default webinar remain unchanged
   */
  function expectWebinarToRemainUnchanged() {
    const existing = webinarRepository.findByIdSync(WEBINAR_ID);
    expect(existing?.props.seats).toEqual(INITIAL_SEATS);
  }

  /**
   * Assert that the webinar's seats have changed to the expected number
   */
  async function thenWebinarSeatsShouldBe(expectedSeats: number) {
    const existing = await webinarRepository.findById(WEBINAR_ID);
    expect(existing?.props.seats).toEqual(expectedSeats);
  }


  describe("Scenario: Happy path", () => {
    const payload = {
      user: testUser.alice,
      webinarId: WEBINAR_ID,
      seats: 200,
    };

    it("should change the number of seats for a webinar", async () => {
      // ACT
      await whenUserChangesSeatsWith(payload);

      // ASSERT
      await thenWebinarSeatsShouldBe(200);
    });
  });

  describe("Scenario: webinar does not exist", () => {
    const payload = {
      user: testUser.alice,
      webinarId: "unknown-id",
      seats: 200,
    };

    it("should fail because the webinar does not exist", async () => {
      await expect(whenUserChangesSeatsWith(payload))
          .rejects
          .toThrowError("Webinar not found");

      expectWebinarToRemainUnchanged(); // confirm the original webinar is still at 100 seats
    });
  });

  describe("Scenario: update the webinar of someone else", () => {
    const payload = {
      user: testUser.bob, // not the organizer
      webinarId: WEBINAR_ID,
      seats: 200,
    };

    it("should fail because only the organizer can update seats", async () => {
      await expect(whenUserChangesSeatsWith(payload))
          .rejects
          .toThrowError("User is not allowed to update this webinar");

      expectWebinarToRemainUnchanged();
    });
  });

  describe("Scenario: change seat to an inferior number", () => {
    const payload = {
      user: testUser.alice,
      webinarId: WEBINAR_ID,
      seats: 50, // below current 100
    };

    it("should fail because you cannot reduce the number of seats", async () => {
      await expect(whenUserChangesSeatsWith(payload))
          .rejects
          .toThrowError("You cannot reduce the number of seats");

      expectWebinarToRemainUnchanged();
    });
  });

  describe("Scenario: change seat to a number > 1000", () => {
    const payload = {
      user: testUser.alice,
      webinarId: WEBINAR_ID,
      seats: 1001,
    };

    it("should fail because seats exceed 1000", async () => {
      await expect(whenUserChangesSeatsWith(payload))
          .rejects
          .toThrowError("Webinar must have at most 1000 seats");

      expectWebinarToRemainUnchanged();
    });
  });
});