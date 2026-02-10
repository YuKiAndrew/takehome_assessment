import { tool } from "ai";
import { z } from "zod";
import { spawnSync } from "child_process";

/**
 * TODO: Implement the code analysis tool
 *
 * This tool should:
 * 1. Accept a Python code string as a parameter
 * 2. Execute the code using the system's Python interpreter
 * 3. Return the stdout output (and stderr if there are errors)
 *
 * How it works:
 *   - The LLM generates Python code to analyze data, do calculations, etc.
 *   - This tool executes that code and returns the output
 *   - The LLM then interprets the results for the user
 *
 * Steps to implement:
 *   a. Define the tool parameters schema using Zod:
 *      - code (string, required): The Python code to execute
 *
 *   b. Execute the Python code:
 *      - Use `child_process.execSync` or `child_process.spawn`
 *      - Run: python3 -c "<code>"
 *      - Set a timeout (e.g., 10 seconds) to prevent infinite loops
 *      - Capture both stdout and stderr
 *
 *   c. Return the results:
 *      - stdout: The program's output
 *      - stderr: Any error messages (if applicable)
 *      - exitCode: 0 for success, non-zero for errors
 *
 *   d. Handle errors:
 *      - Timeout exceeded
 *      - Python not installed
 *      - Syntax errors in the code
 *      - Runtime errors
 *
 * Hints:
 *   - Use `execSync` for simplicity, it blocks until the command finishes
 *   - Pass the code via stdin or -c flag to avoid shell escaping issues
 *   - Set `maxBuffer` to handle larger outputs
 *   - Consider using `spawnSync` with `input` option to pipe code via stdin:
 *       spawnSync("python3", ["-c", code], { timeout: 10000, encoding: "utf-8" })
 *
 * Safety notes (mention in INSTRUCTIONS.md):
 *   - This runs arbitrary code on the local machine
 *   - In production, you would sandbox this (Docker, etc.)
 *   - For this assessment, local execution is fine
 */

export const analyzeTool = tool({
  description:
    "Execute Python code for data analysis, calculations, or processing. The LLM writes Python code, and this tool runs it and returns the output. Use this for mathematical calculations, data analysis, or any computational tasks.",
  parameters: z.object({
    code: z
      .string()
      .min(1, "Code must not be empty")
      .describe(
        "Python code to execute. The code should print results to stdout. Example: print(sum([1,2,3,4,5]))"
      ),
  }),
  execute: async (params) => {
    const code = params.code?.trim();
    if (!code) {
      return {
        error: "No Python code provided to execute",
        exitCode: -1,
      };
    }

    try {
      // Execute Python code with timeout
      const result = spawnSync("python", ["-c", params.code], {
        timeout: 10000, // 10 seconds timeout
        encoding: "utf-8",
        maxBuffer: 1024 * 1024, // 1MB max buffer
      });

      // Check if the process timed out
      if (result.error) {
        if (result.error.message.includes("ETIMEDOUT")) {
          return {
            error: "Execution timed out (exceeded 10 seconds)",
            exitCode: -1,
          };
        }
        return {
          error: `Failed to execute Python: ${result.error.message}`,
          exitCode: -1,
        };
      }

      // Return the results
      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.status || 0,
        success: result.status === 0,
      };
    } catch (error) {
      // Handle unexpected errors
      if (error instanceof Error) {
        return {
          error: `Unexpected error: ${error.message}`,
          exitCode: -1,
        };
      }
      return {
        error: "An unknown error occurred while executing Python code",
        exitCode: -1,
      };
    }
  },
});
