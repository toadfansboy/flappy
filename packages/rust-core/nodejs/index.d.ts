/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

/**
 * Execute a python code snippet in a wasm sandbox.
 * @param code - The python code snippet to execute.
 * @param network - Whether to allow network access.
 * @param cache_path - The path to store the wasm modules and dependencies.
 * @returns The stdout and stderr of the python code snippet.
 */
export function evalPythonCode(code: string, network: boolean, envs: Array<[string, string]>, cachePath?: string | undefined | null): Promise<StdOutput>
export class StdOutput {
  stdout: string
  stderr: string
}
