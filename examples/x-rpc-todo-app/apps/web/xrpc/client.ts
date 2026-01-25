import { taskListInputSchema, taskListOutputSchema, taskGetInputSchema, taskGetOutputSchema, taskCreateInputSchema, taskCreateOutputSchema, taskUpdateInputSchema, taskUpdateOutputSchema, taskDeleteInputSchema, taskDeleteOutputSchema, subtaskAddInputSchema, subtaskAddOutputSchema, subtaskToggleInputSchema, subtaskToggleOutputSchema, type TaskListInput, type TaskListOutput, type TaskGetInput, type TaskGetOutput, type TaskCreateInput, type TaskCreateOutput, type TaskUpdateInput, type TaskUpdateOutput, type TaskDeleteInput, type TaskDeleteOutput, type SubtaskAddInput, type SubtaskAddOutput, type SubtaskToggleInput, type SubtaskToggleOutput } from './types';

import { z } from 'zod';


export interface XRpcClientConfig {
    baseUrl: string;
    validateInputs?: boolean;
    validateOutputs?: boolean;
    headers?: Record<string, string>;
}


// Base RPC call function
export async function callRpc<T>(config: XRpcClientConfig, method: string, params: unknown, options?: { inputSchema?: z.ZodType; outputSchema?: z.ZodType; signal?: AbortSignal }) {
    // Validate input if enabled
    let validatedParams = params;
    if (config.validateInputs !== false && options?.inputSchema) {
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

// === Individual Functions (backward compatible) ===

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


// === Client Factory ===

export function createClient(config: XRpcClientConfig) {
    return {
        task: {
            list: (input: TaskListInput, options?: { signal?: AbortSignal }) =>
                taskList(config, input, options),
            get: (input: TaskGetInput, options?: { signal?: AbortSignal }) =>
                taskGet(config, input, options),
            create: (input: TaskCreateInput, options?: { signal?: AbortSignal }) =>
                taskCreate(config, input, options),
            update: (input: TaskUpdateInput, options?: { signal?: AbortSignal }) =>
                taskUpdate(config, input, options),
            delete: (input: TaskDeleteInput, options?: { signal?: AbortSignal }) =>
                taskDelete(config, input, options)
        },
        subtask: {
            add: (input: SubtaskAddInput, options?: { signal?: AbortSignal }) =>
                subtaskAdd(config, input, options),
            toggle: (input: SubtaskToggleInput, options?: { signal?: AbortSignal }) =>
                subtaskToggle(config, input, options)
        }
    };
}

export type ApiClient = ReturnType<typeof createClient>;
