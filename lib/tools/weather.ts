import { tool } from "ai";
import { z } from "zod";

/**
 * TODO: Implement the weather data tool
 *
 * This tool should:
 * 1. Accept parameters for location, forecast days, and weather variables
 * 2. Use the Open-Meteo API to fetch weather forecast data
 * 3. Return structured weather data that the LLM can use to answer questions
 *
 * Open-Meteo API docs: https://open-meteo.com/en/docs
 * Base URL: https://api.open-meteo.com/v1/forecast
 *
 * Example API call:
 *   https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3
 *
 * Steps to implement:
 *   a. Define the tool parameters schema using Zod:
 *      - latitude (number, required): Latitude of the location
 *      - longitude (number, required): Longitude of the location
 *      - forecast_days (number, optional, default 3): Number of days to forecast (1-7)
 *      - daily (array of strings, optional): Weather variables to include
 *        Useful variables: temperature_2m_max, temperature_2m_min,
 *        precipitation_sum, windspeed_10m_max, weathercode
 *
 *   b. Make a fetch request to the Open-Meteo API with the parameters
 *
 *   c. Parse the JSON response and return it
 *
 *   d. Handle errors:
 *      - API errors (non-200 status)
 *      - Network failures
 *      - Invalid response format
 *
 * Hints:
 *   - The LLM will provide latitude/longitude — you can trust it to geocode city names
 *   - Open-Meteo is free and requires no API key
 *   - Keep the return format simple — the LLM will format it for the user
 */

export const weatherTool = tool({
  description:
    "Get weather forecast data for a location. Use this when the user asks about weather, temperature, rain, wind, or forecasts for any location.",
  parameters: z.object({
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
    forecast_days: z
      .number()
      .min(1)
      .max(14)
      .default(3)
      .describe("Number of days to forecast (1-14)"),
    daily: z
      .array(z.string())
      .default([
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "windspeed_10m_max",
        "weathercode",
      ])
      .describe(
        "Weather variables to include (e.g., temperature_2m_max, temperature_2m_min, precipitation_sum, windspeed_10m_max, weathercode)"
      ),
  }),
  execute: async (params) => {
    try {
      // Build the API URL with query parameters
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.append("latitude", params.latitude.toString());
      url.searchParams.append("longitude", params.longitude.toString());
      url.searchParams.append("daily", params.daily.join(","));
      url.searchParams.append("timezone", "auto");
      url.searchParams.append(
        "forecast_days",
        params.forecast_days.toString()
      );

      // Fetch data from Open-Meteo API
      const response = await fetch(url.toString());

      // Handle non-200 responses
      if (!response.ok) {
        const body = await response.text();
        return {
          error: `API request failed with status ${response.status}: ${response.statusText}`,
          ...(body && { detail: body.slice(0, 200) }),
        };
      }

      // Parse the JSON response (may throw if body is not JSON)
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        return {
          error: "Invalid response: could not parse JSON from weather API",
        };
      }

      // Validate that we got the expected structure
      if (!data || typeof data !== "object" || !("daily" in data) || !(data as Record<string, unknown>).daily) {
        return {
          error: "Invalid response format: missing daily forecast data",
        };
      }

      const forecast = data as {
        latitude?: number;
        longitude?: number;
        timezone?: string;
        daily: unknown;
        daily_units?: unknown;
      };
      return {
        latitude: forecast.latitude,
        longitude: forecast.longitude,
        timezone: forecast.timezone,
        daily: forecast.daily,
        daily_units: forecast.daily_units,
      };
    } catch (error) {
      // Handle network failures, DNS, and other errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return { error: "Network error: could not reach weather API." };
      }
      if (error instanceof Error) {
        return {
          error: `Failed to fetch weather data: ${error.message}`,
        };
      }
      return {
        error: "An unexpected error occurred while fetching weather data",
      };
    }
  },
});