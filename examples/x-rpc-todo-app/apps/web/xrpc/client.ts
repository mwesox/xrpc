import { useState, useEffect, useRef } from 'react';

import { taskListInputSchema, taskListOutputSchema, taskGetInputSchema, taskGetOutputSchema, taskCreateInputSchema, taskCreateOutputSchema, taskUpdateInputSchema, taskUpdateOutputSchema, taskDeleteInputSchema, taskDeleteOutputSchema, subtaskAddInputSchema, subtaskAddOutputSchema, subtaskToggleInputSchema, subtaskToggleOutputSchema, subtaskDeleteInputSchema, subtaskDeleteOutputSchema, tagAddInputSchema, tagAddOutputSchema, tagRemoveInputSchema, tagRemoveOutputSchema, type TaskListInput, type TaskListOutput, type TaskGetInput, type TaskGetOutput, type TaskCreateInput, type TaskCreateOutput, type TaskUpdateInput, type TaskUpdateOutput, type TaskDeleteInput, type TaskDeleteOutput, type SubtaskAddInput, type SubtaskAddOutput, type SubtaskToggleInput, type SubtaskToggleOutput, type SubtaskDeleteInput, type SubtaskDeleteOutput, type TagAddInput, type TagAddOutput, type TagRemoveInput, type TagRemoveOutput } from './types';

import { z } from 'zod';


export interface XRpcClientConfig {
    baseUrl: string;
    validateInputs?: boolean;
    validateOutputs?: boolean;
    headers?: Record<string, string>;
}


// Base RPC call function (pure, no React dependencies)
export async function callRpc<T>(config: XRpcClientConfig, method: string, params: unknown, options?: { inputSchema?: z.ZodType; outputSchema?: z.ZodType; signal?: AbortSignal }) {
    // Validate input if enabled
    let validatedParams = params;
    if (config.validateInputs && options?.inputSchema) {
        validatedParams = options.inputSchema.parse(params);
    }

    // Make HTTP request
    const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...config.headers,
        },
        body: JSON.stringify({ method, params: validatedParams }),
        signal: options?.signal,
    });

    // Handle errors
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `RPC call failed: ${response.statusText}`);
    }

    // Parse response
    const result = await response.json();
    // Handle JSON-RPC response format
    if (result.error) {
        throw new Error(result.error.message || result.error);
    }
    const data = result.result;

    // Validate output if enabled
    if (config.validateOutputs && options?.outputSchema) {
        return options.outputSchema.parse(data);
    }

    return data;
}


// Type-safe wrapper for task.list
export async function taskList(config: XRpcClientConfig, input: TaskListInput, options?: { signal?: AbortSignal }) {
    return callRpc<TaskListOutput>(
        config,
        'task.list',
        input,
        {
            inputSchema: taskListInputSchema,
            outputSchema: taskListOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for task.get
export async function taskGet(config: XRpcClientConfig, input: TaskGetInput, options?: { signal?: AbortSignal }) {
    return callRpc<TaskGetOutput>(
        config,
        'task.get',
        input,
        {
            inputSchema: taskGetInputSchema,
            outputSchema: taskGetOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for task.create
export async function taskCreate(config: XRpcClientConfig, input: TaskCreateInput, options?: { signal?: AbortSignal }) {
    return callRpc<TaskCreateOutput>(
        config,
        'task.create',
        input,
        {
            inputSchema: taskCreateInputSchema,
            outputSchema: taskCreateOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for task.update
export async function taskUpdate(config: XRpcClientConfig, input: TaskUpdateInput, options?: { signal?: AbortSignal }) {
    return callRpc<TaskUpdateOutput>(
        config,
        'task.update',
        input,
        {
            inputSchema: taskUpdateInputSchema,
            outputSchema: taskUpdateOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for task.delete
export async function taskDelete(config: XRpcClientConfig, input: TaskDeleteInput, options?: { signal?: AbortSignal }) {
    return callRpc<TaskDeleteOutput>(
        config,
        'task.delete',
        input,
        {
            inputSchema: taskDeleteInputSchema,
            outputSchema: taskDeleteOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for subtask.add
export async function subtaskAdd(config: XRpcClientConfig, input: SubtaskAddInput, options?: { signal?: AbortSignal }) {
    return callRpc<SubtaskAddOutput>(
        config,
        'subtask.add',
        input,
        {
            inputSchema: subtaskAddInputSchema,
            outputSchema: subtaskAddOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for subtask.toggle
export async function subtaskToggle(config: XRpcClientConfig, input: SubtaskToggleInput, options?: { signal?: AbortSignal }) {
    return callRpc<SubtaskToggleOutput>(
        config,
        'subtask.toggle',
        input,
        {
            inputSchema: subtaskToggleInputSchema,
            outputSchema: subtaskToggleOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for subtask.delete
export async function subtaskDelete(config: XRpcClientConfig, input: SubtaskDeleteInput, options?: { signal?: AbortSignal }) {
    return callRpc<SubtaskDeleteOutput>(
        config,
        'subtask.delete',
        input,
        {
            inputSchema: subtaskDeleteInputSchema,
            outputSchema: subtaskDeleteOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for tag.add
export async function tagAdd(config: XRpcClientConfig, input: TagAddInput, options?: { signal?: AbortSignal }) {
    return callRpc<TagAddOutput>(
        config,
        'tag.add',
        input,
        {
            inputSchema: tagAddInputSchema,
            outputSchema: tagAddOutputSchema,
            signal: options?.signal,
        }
    );
}


// Type-safe wrapper for tag.remove
export async function tagRemove(config: XRpcClientConfig, input: TagRemoveInput, options?: { signal?: AbortSignal }) {
    return callRpc<TagRemoveOutput>(
        config,
        'tag.remove',
        input,
        {
            inputSchema: tagRemoveInputSchema,
            outputSchema: tagRemoveOutputSchema,
            signal: options?.signal,
        }
    );
}


// React Hooks

// React hook for task.list query
export function useTaskList(config: XRpcClientConfig, input: TaskListInput, options?: { enabled?: boolean }) {
    const [data, setData] = useState<TaskListOutput | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Skip if disabled
        if (options?.enabled === false) return;

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new AbortController
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setLoading(true);
        setError(null);

        taskList(config, input, { signal: abortController.signal })
            .then(setData)
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    setError(err);
                }
            })
            .finally(() => {
                if (!abortController.signal.aborted) {
                    setLoading(false);
                }
            });

            // Cleanup on unmount or input change
            return () => {
                abortController.abort();
            };
        // Note: input is serialized for stable dependency comparison
        }, [config.baseUrl, JSON.stringify(input), options?.enabled]);

        return { data, loading, error };
    }

    // React hook for task.get query
export function useTaskGet(config: XRpcClientConfig, input: TaskGetInput, options?: { enabled?: boolean }) {
        const [data, setData] = useState<TaskGetOutput | null>(null);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<Error | null>(null);
        const abortControllerRef = useRef<AbortController | null>(null);

        useEffect(() => {
            // Skip if disabled
            if (options?.enabled === false) return;

            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new AbortController
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            setLoading(true);
            setError(null);

            taskGet(config, input, { signal: abortController.signal })
                .then(setData)
                .catch((err) => {
                    if (err.name !== 'AbortError') {
                        setError(err);
                    }
                })
                .finally(() => {
                    if (!abortController.signal.aborted) {
                        setLoading(false);
                    }
                });

                // Cleanup on unmount or input change
                return () => {
                    abortController.abort();
                };
            // Note: input is serialized for stable dependency comparison
            }, [config.baseUrl, JSON.stringify(input), options?.enabled]);

            return { data, loading, error };
        }

        // React hook for task.create mutation
export function useTaskCreate(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: TaskCreateInput): Promise<TaskCreateOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await taskCreate(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for task.update mutation
export function useTaskUpdate(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: TaskUpdateInput): Promise<TaskUpdateOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await taskUpdate(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for task.delete mutation
export function useTaskDelete(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: TaskDeleteInput): Promise<TaskDeleteOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await taskDelete(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for subtask.add mutation
export function useSubtaskAdd(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: SubtaskAddInput): Promise<SubtaskAddOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await subtaskAdd(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for subtask.toggle mutation
export function useSubtaskToggle(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: SubtaskToggleInput): Promise<SubtaskToggleOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await subtaskToggle(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for subtask.delete mutation
export function useSubtaskDelete(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: SubtaskDeleteInput): Promise<SubtaskDeleteOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await subtaskDelete(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for tag.add mutation
export function useTagAdd(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: TagAddInput): Promise<TagAddOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await tagAdd(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }

        // React hook for tag.remove mutation
export function useTagRemove(config: XRpcClientConfig) {
            const [loading, setLoading] = useState(false);
            const [error, setError] = useState<Error | null>(null);

            const mutate = async (input: TagRemoveInput): Promise<TagRemoveOutput> => {
                setLoading(true);
                setError(null);

                try {
                    const result = await tagRemove(config, input);
                    return result;
                } catch (err) {
                    setError(err as Error);
                    throw err;
                } finally {
                    setLoading(false);
                }
            };

            return { mutate, loading, error };
        }
