import axios, { type AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * Creates a pre-configured Axios instance for Schiphol API interactions,
 * which encapsulates authentication headers and timeout settings to ensure
 * consistent behavior across all API calls.
 */

export const createSchipholClient = (): AxiosInstance => {
  const baseURL = process.env.SCHIPHOL_API_URL;
  const appId = process.env.SCHIPHOL_APP_ID;
  const appKey = process.env.SCHIPHOL_APP_KEY;

  if (!baseURL || !appId || !appKey) {
    throw new Error(
      "Missing Schiphol API configuration in environment variables."
    );
  }

  return axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      ResourceVersion: "v4",
      "app-id": appId,
      "app-key": appKey,
      Accept: "application/json",
    },
  });
};
