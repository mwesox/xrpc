import { router } from '../../../packages/api/src/contract';

import type { InferInput, InferOutput } from '@xrpckit/schema';


export const taskListInputSchema = router.task.list.input;

export const taskListOutputSchema = router.task.list.output;

export type TaskListInput = InferInput<typeof router.task.list>;

export type TaskListOutput = InferOutput<typeof router.task.list>;


export const taskGetInputSchema = router.task.get.input;

export const taskGetOutputSchema = router.task.get.output;

export type TaskGetInput = InferInput<typeof router.task.get>;

export type TaskGetOutput = InferOutput<typeof router.task.get>;


export const taskCreateInputSchema = router.task.create.input;

export const taskCreateOutputSchema = router.task.create.output;

export type TaskCreateInput = InferInput<typeof router.task.create>;

export type TaskCreateOutput = InferOutput<typeof router.task.create>;


export const taskUpdateInputSchema = router.task.update.input;

export const taskUpdateOutputSchema = router.task.update.output;

export type TaskUpdateInput = InferInput<typeof router.task.update>;

export type TaskUpdateOutput = InferOutput<typeof router.task.update>;


export const taskDeleteInputSchema = router.task.delete.input;

export const taskDeleteOutputSchema = router.task.delete.output;

export type TaskDeleteInput = InferInput<typeof router.task.delete>;

export type TaskDeleteOutput = InferOutput<typeof router.task.delete>;


export const subtaskAddInputSchema = router.subtask.add.input;

export const subtaskAddOutputSchema = router.subtask.add.output;

export type SubtaskAddInput = InferInput<typeof router.subtask.add>;

export type SubtaskAddOutput = InferOutput<typeof router.subtask.add>;


export const subtaskToggleInputSchema = router.subtask.toggle.input;

export const subtaskToggleOutputSchema = router.subtask.toggle.output;

export type SubtaskToggleInput = InferInput<typeof router.subtask.toggle>;

export type SubtaskToggleOutput = InferOutput<typeof router.subtask.toggle>;


export const subtaskDeleteInputSchema = router.subtask.delete.input;

export const subtaskDeleteOutputSchema = router.subtask.delete.output;

export type SubtaskDeleteInput = InferInput<typeof router.subtask.delete>;

export type SubtaskDeleteOutput = InferOutput<typeof router.subtask.delete>;


export const tagAddInputSchema = router.tag.add.input;

export const tagAddOutputSchema = router.tag.add.output;

export type TagAddInput = InferInput<typeof router.tag.add>;

export type TagAddOutput = InferOutput<typeof router.tag.add>;


export const tagRemoveInputSchema = router.tag.remove.input;

export const tagRemoveOutputSchema = router.tag.remove.output;

export type TagRemoveInput = InferInput<typeof router.tag.remove>;

export type TagRemoveOutput = InferOutput<typeof router.tag.remove>;

