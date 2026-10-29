import { HEALTH_CHECK_CONFIG } from "@/constants";

export type HealthStatus = "healthy" | "unhealthy" | "error";

export interface HealthCheckResult {
  status: HealthStatus;
  latency: number;
  message?: string;
}

/**
 * Performs a health check on the given URL
 * @param url - The URL to check
 * @returns A promise that resolves to the health check result
 */
export async function checkHealth(url: string): Promise<HealthCheckResult> {
  const startTime = performance.now();

  try {
    // Validate URL
    try {
      new URL(url);
    } catch {
      return {
        status: "error",
        latency: 0,
        message: "Invalid URL format",
      };
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_CONFIG.timeout);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        mode: "cors",
        cache: "no-cache",
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (
        (HEALTH_CHECK_CONFIG.expectedStatusCodes as readonly number[]).includes(response.status)
      ) {
        return {
          status: "healthy",
          latency,
          message: `${response.status} OK`,
        };
      } else {
        return {
          status: "unhealthy",
          latency,
          message: `HTTP ${response.status}`,
        };
      }
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - startTime);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return {
          status: "error",
          latency: HEALTH_CHECK_CONFIG.timeout,
          message: `Timeout after ${HEALTH_CHECK_CONFIG.timeout}ms`,
        };
      }

      // CORS or network error
      if (fetchError instanceof TypeError) {
        return {
          status: "error",
          latency,
          message: "CORS or network error",
        };
      }

      return {
        status: "error",
        latency,
        message: fetchError instanceof Error ? fetchError.message : "Unknown error",
      };
    }
  } catch (error) {
    return {
      status: "error",
      latency: Math.round(performance.now() - startTime),
      message: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}
