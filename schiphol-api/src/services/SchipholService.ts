import { type AxiosInstance, isAxiosError } from "axios";
import { createSchipholClient } from "../infra/http-client";
import {
  SchipholResponseSchema,
  type FlightData,
} from "../config/flight-schema";
import { treeifyError } from "zod";

export class SchipholService {
  private client: AxiosInstance;
  public MAX_PAGES = 200; // Circuit Breaker to prevent infinite loops

  constructor() {
    // Initialize the HTTP client with pre-configured headers and timeout.
    this.client = createSchipholClient();
  }

  /**
   * Fetches all flight data for the current day by traversing pagination links.
   * Strategy:
   * 0. Initialize parameters
   * a. Network Request
   * b. Validation (Zod)
   * c. Accumulate valid flights
   * d. Parse 'Link' header to find the next page URL.
   * e. Repeat until no 'next' link or MAX_PAGES reached.
   */
  public async fetchFlights(): Promise<FlightData[]> {
    console.log("[SchipholService] Starting recursive flight fetch...");

    // 0. Initial parameters
    // includedelays=false: Calculate delays ourselves via strict math
    // sort=+scheduleTime: Get earliest flights first to ensure chronological order
    const today = new Date().toISOString().split("T")[0];
    let nextUrl:
      | string
      | null = `/public-flights/flights?scheduleDate=${today}&includedelays=false&page=0&sort=+scheduleTime`;

    const allFlights: FlightData[] = [];
    let pageCount = 0;

    try {
      while (nextUrl && pageCount < this.MAX_PAGES) {
        // a. Network Request
        // Note: nextUrl might be a full URL from the Link header. Axios handles this correctly.
        const response = await this.client.get(nextUrl);

        // b. Validation (Zod)
        const validationResult = SchipholResponseSchema.safeParse(
          response.data
        );

        if (!validationResult.success) {
          console.error(
            `[SchipholService] Schema Validation Failed on page ${pageCount}:`,
            JSON.stringify(treeifyError(validationResult.error), null, 2)
          );
          // Decision: Stop fetching if structure is invalid to prevent data corruption.
          throw new Error(
            "Schiphol API response does not match expected schema"
          );
        }

        // c. Accumulate valid flights
        const validFlights = validationResult.data.flights;
        allFlights.push(...validFlights);
        pageCount++;

        // d. Pagination Logic: Extract 'next' link from RFC 5988 Link header
        const linkHeader = response.headers["link"];
        nextUrl = this.parseNextLink(linkHeader);
      }

      // e. Repeat until no 'next' link or MAX_PAGES reached.
      if (pageCount >= this.MAX_PAGES) {
        console.warn(
          `[SchipholService] Reached max page limit (${this.MAX_PAGES}). Fetching stopped.`
        );
      }

      console.log(
        `[SchipholService] Successfully fetched and validated ${allFlights.length} flights across ${pageCount} pages.`
      );

      return allFlights;
    } catch (error) {
      this.handleError(error);
      throw error; // Re-throw to propagate failure to the orchestrator
    }
  }

  /**
   * Parses the RFC 5988 Link header to find the URL with rel="next".
   */
  private parseNextLink(linkHeader: string | undefined): string | null {
    if (!linkHeader) return null;

    // Regex to capture the URL inside <...> where the following parameter is rel="next"
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);

    return match?.[1] || null;
  }

  /**
   * Centralized Error Handling Logic
   */
  private handleError(error: unknown): void {
    if (isAxiosError(error)) {
      console.error(`[SchipholService] HTTP Error: ${error.message}`);
      if (error.response) {
        console.error(`[SchipholService] Status: ${error.response.status}`);
        console.error(
          `[SchipholService] Data: ${JSON.stringify(error.response.data)}`
        );
      }
    } else {
      console.error("[SchipholService] An unexpected error occurred:", error);
    }
  }
}
