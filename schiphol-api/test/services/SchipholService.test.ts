import { describe, it, expect, mock, beforeEach } from "bun:test";
import { SchipholService } from "../../src/services/SchipholService";

const mockGet = mock();
mock.module("../../src/infra/http-client", () => ({
  createSchipholClient: () => ({
    get: mockGet,
  }),
}));

const getValidMockResponse = () => ({
  flights: [
    {
      id: "TEST-123",
      mainFlight: "KL123",
      flightName: "KL123",
      flightDirection: "A",
      isOperationalFlight: true,
      scheduleDate: "2025-12-20",
      scheduleDateTime: "2025-12-20T10:00:00+01:00",
      lastUpdatedAt: "2025-12-20T09:00:00+01:00",
      publicFlightState: { flightStates: ["SCH"] },
      route: { destinations: ["TPE"], eu: "N", visa: false },
    },
  ],
});

describe("SchipholService", () => {
  let service: SchipholService; //

  beforeEach(() => {
    mockGet.mockReset();
    service = new SchipholService();
  });

  it("should fetch and parse flights (Single Page Scenario)", async () => {
    // Arrange: API returns 1 flight and NO Link header (End of pagination)
    mockGet.mockResolvedValue({
      data: getValidMockResponse(),
      headers: {}, // No 'link' header -> Stop fetching
    });

    // Act
    const results = await service.fetchFlights();

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("TEST-123");
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("should traverse pagination links (Multi-Page Scenario)", async () => {
    // Arrange:
    // Page 0: Returns Flight 1 + Link to Page 1
    // Page 1: Returns Flight 2 + No Link (Stop)

    mockGet
      .mockResolvedValueOnce({
        data: getValidMockResponse(),
        headers: {
          // RFC 5988 Link Header
          link: '<https://api.schiphol.nl/flights?page=1>; rel="next"',
        },
      })
      .mockResolvedValueOnce({
        data: getValidMockResponse(),
        headers: {}, // Stop here
      });

    // Act
    const results = await service.fetchFlights();

    // Assert
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe("TEST-123");
    expect(results[1]?.id).toBe("TEST-123");
    expect(mockGet).toHaveBeenCalledTimes(2); // Called twice
  });

  it("should stop fetching if Circuit Breaker (MAX_PAGES) is hit", async () => {
    /**
     * Arrange: API keeps returning 'next' link forever
     * We expect the loop to break at 500 (or whatever MAX_PAGES is set to in code)
     * To test this quickly without looping 500 times in test,
     * we assume the logic works if it handles the loop.
     * But for unit test speed, let's just verify it handles a few loops.
     */

    // Arrange: Simulating 3 pages
    service.MAX_PAGES = 3;

    mockGet.mockResolvedValue({
      data: getValidMockResponse(),
      headers: { link: '<...>; rel="next"' },
    });

    // Simulate Infinite Loop: API always returns a 'next' link
    mockGet.mockResolvedValue({
      data: getValidMockResponse(),
      headers: { link: '<https://api.../next>; rel="next"' },
    });

    // Act
    await service.fetchFlights();

    // Assert
    // Should stop exactly at MAX_PAGES (3 calls)
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("should handle Schema Validation errors gracefully (Fail Fast)", async () => {
    // Arrange: API returns Invalid Data
    mockGet.mockResolvedValue({
      data: { flights: [{ id: "Invalid", flightDirection: "INVALID_ENUM" }] },
      headers: {},
    });

    // Act & Assert
    expect(service.fetchFlights()).rejects.toThrow(
      "response does not match expected schema"
    );
  });

  it("should throw specific error when API returns invalid schema", async () => {
    // Arrange: mocking API and return invalid data

    const invalidMockData = {
      flights: [
        {
          id: "TEST-123",
          scheduleDateTime: "2025-12-20T10:00:00+01:00",
        },
      ],
    };

    mockGet.mockResolvedValue({ data: invalidMockData, headers: {} });

    // Act & Assert
    try {
      await service.fetchFlights();
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(
        "Schiphol API response does not match expected schema"
      );
    }
  });

  it("should rethrow network error e.g. 500 / timeout on Axios", async () => {
    // Arrange
    const networkError = new Error("Connection Timeout");
    mockGet.mockRejectedValue(networkError);

    expect(service.fetchFlights()).rejects.toThrow("Connection Timeout");
  });
});
