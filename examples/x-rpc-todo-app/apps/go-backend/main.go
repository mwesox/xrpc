package main

import (
	"log"
	"net/http"

	"go-backend/xrpc"
)

var db *DB

func main() {
	var err error
	db, err = NewDB("./tasks.db")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Create xRPC router with type-safe handlers
	// Validation is automatically applied before handlers are called
	router := xrpc.NewRouter().
		// Task endpoints
		TaskList(handleTaskList).
		TaskGet(handleTaskGet).
		TaskCreate(handleTaskCreate).
		TaskUpdate(handleTaskUpdate).
		TaskDelete(handleTaskDelete).
		// Subtask endpoints
		SubtaskAdd(handleSubtaskAdd).
		SubtaskToggle(handleSubtaskToggle).
		SubtaskDelete(handleSubtaskDelete).
		// Tag endpoints
		TagAdd(handleTagAdd).
		TagRemove(handleTagRemove)

	// Wrap with CORS middleware
	http.Handle("/api", corsMiddleware(router))

	log.Println("Go backend running on :8080")
	log.Println("Using generated xRPC router with automatic validation")
	log.Println("Validation includes: UUID, enum, regex pattern, string length, number range")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// =============================================================================
// TASK HANDLERS
// =============================================================================

func handleTaskList(ctx *xrpc.Context, input xrpc.TaskListInput) (xrpc.TaskListOutput, error) {
	var status, priority *string
	var limit *int
	if input.Status != "" {
		status = &input.Status
	}
	if input.Priority != "" {
		priority = &input.Priority
	}
	if input.Limit > 0 {
		l := int(input.Limit)
		limit = &l
	}

	tasks, total, err := db.ListTasks(status, priority, limit)
	if err != nil {
		return xrpc.TaskListOutput{}, err
	}

	// Convert to output format
	outputTasks := make([]interface{}, len(tasks))
	for i, t := range tasks {
		task := map[string]interface{}{
			"id":                    t.Id,
			"title":                 t.Title,
			"status":                t.Status,
			"priority":              t.Priority,
			"createdAt":             t.CreatedAt,
			"tagCount":              float64(t.TagCount),
			"subtaskCount":          float64(t.SubtaskCount),
			"subtaskCompletedCount": float64(t.SubtaskCompletedCount),
			"position":              float64(t.Position),
		}
		if t.DueDate != nil {
			task["dueDate"] = *t.DueDate
		}
		if t.CompletedAt != nil {
			task["completedAt"] = *t.CompletedAt
		}
		if t.EstimatedHours != nil {
			task["estimatedHours"] = *t.EstimatedHours
		}
		outputTasks[i] = task
	}

	return xrpc.TaskListOutput{
		Tasks: outputTasks,
		Total: float64(total),
	}, nil
}

func handleTaskGet(ctx *xrpc.Context, input xrpc.TaskGetInput) (xrpc.TaskGetOutput, error) {
	task, err := db.GetTask(input.Id)
	if err != nil {
		return xrpc.TaskGetOutput{}, err
	}

	return taskToOutput(task), nil
}

func handleTaskCreate(ctx *xrpc.Context, input xrpc.TaskCreateInput) (xrpc.TaskCreateOutput, error) {
	task, err := db.CreateTask(input)
	if err != nil {
		return xrpc.TaskCreateOutput{}, err
	}

	output := taskToOutput(task)
	return xrpc.TaskCreateOutput{
		Id:             output.Id,
		Title:          output.Title,
		Description:    output.Description,
		Status:         output.Status,
		Priority:       output.Priority,
		DueDate:        output.DueDate,
		CreatedAt:      output.CreatedAt,
		CompletedAt:    output.CompletedAt,
		Assignee:       output.Assignee,
		Tags:           output.Tags,
		Subtasks:       output.Subtasks,
		EstimatedHours: output.EstimatedHours,
		Position:       output.Position,
	}, nil
}

func handleTaskUpdate(ctx *xrpc.Context, input xrpc.TaskUpdateInput) (xrpc.TaskUpdateOutput, error) {
	task, err := db.UpdateTask(input)
	if err != nil {
		return xrpc.TaskUpdateOutput{}, err
	}

	output := taskToOutput(task)
	return xrpc.TaskUpdateOutput{
		Id:             output.Id,
		Title:          output.Title,
		Description:    output.Description,
		Status:         output.Status,
		Priority:       output.Priority,
		DueDate:        output.DueDate,
		CreatedAt:      output.CreatedAt,
		CompletedAt:    output.CompletedAt,
		Assignee:       output.Assignee,
		Tags:           output.Tags,
		Subtasks:       output.Subtasks,
		EstimatedHours: output.EstimatedHours,
		Position:       output.Position,
	}, nil
}

func handleTaskDelete(ctx *xrpc.Context, input xrpc.TaskDeleteInput) (xrpc.TaskDeleteOutput, error) {
	if err := db.DeleteTask(input.Id); err != nil {
		return xrpc.TaskDeleteOutput{}, err
	}
	return xrpc.TaskDeleteOutput{Success: true}, nil
}

// =============================================================================
// SUBTASK HANDLERS
// =============================================================================

func handleSubtaskAdd(ctx *xrpc.Context, input xrpc.SubtaskAddInput) (xrpc.SubtaskAddOutput, error) {
	subtask, err := db.AddSubtask(input.TaskId, input.Title)
	if err != nil {
		return xrpc.SubtaskAddOutput{}, err
	}
	return xrpc.SubtaskAddOutput{
		Id:        subtask.Id,
		Title:     subtask.Title,
		Completed: subtask.Completed,
	}, nil
}

func handleSubtaskToggle(ctx *xrpc.Context, input xrpc.SubtaskToggleInput) (xrpc.SubtaskToggleOutput, error) {
	subtask, err := db.ToggleSubtask(input.TaskId, input.SubtaskId)
	if err != nil {
		return xrpc.SubtaskToggleOutput{}, err
	}
	return xrpc.SubtaskToggleOutput{
		Id:        subtask.Id,
		Title:     subtask.Title,
		Completed: subtask.Completed,
	}, nil
}

func handleSubtaskDelete(ctx *xrpc.Context, input xrpc.SubtaskDeleteInput) (xrpc.SubtaskDeleteOutput, error) {
	if err := db.DeleteSubtask(input.TaskId, input.SubtaskId); err != nil {
		return xrpc.SubtaskDeleteOutput{}, err
	}
	return xrpc.SubtaskDeleteOutput{Success: true}, nil
}

// =============================================================================
// TAG HANDLERS
// =============================================================================

func handleTagAdd(ctx *xrpc.Context, input xrpc.TagAddInput) (xrpc.TagAddOutput, error) {
	tag, err := db.AddTag(input.TaskId, input.Name, input.Color)
	if err != nil {
		return xrpc.TagAddOutput{}, err
	}
	return xrpc.TagAddOutput{
		Name:  tag.Name,
		Color: tag.Color,
	}, nil
}

func handleTagRemove(ctx *xrpc.Context, input xrpc.TagRemoveInput) (xrpc.TagRemoveOutput, error) {
	if err := db.RemoveTag(input.TaskId, input.TagName); err != nil {
		return xrpc.TagRemoveOutput{}, err
	}
	return xrpc.TagRemoveOutput{Success: true}, nil
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

func taskToOutput(task *FullTask) xrpc.TaskGetOutput {
	output := xrpc.TaskGetOutput{
		Id:        task.Id,
		Title:     task.Title,
		Status:    task.Status,
		Priority:  task.Priority,
		CreatedAt: task.CreatedAt,
		Position:  float64(task.Position),
	}

	if task.Description != nil {
		output.Description = *task.Description
	}
	if task.DueDate != nil {
		output.DueDate = *task.DueDate
	}
	if task.CompletedAt != nil {
		output.CompletedAt = task.CompletedAt
	}
	if task.EstimatedHours != nil {
		output.EstimatedHours = *task.EstimatedHours
	}

	// Convert tags
	tags := make([]interface{}, len(task.Tags))
	for i, t := range task.Tags {
		tags[i] = map[string]interface{}{
			"name":  t.Name,
			"color": t.Color,
		}
	}
	output.Tags = tags

	// Convert subtasks
	subtasks := make([]interface{}, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = map[string]interface{}{
			"id":        s.Id,
			"title":     s.Title,
			"completed": s.Completed,
		}
	}
	output.Subtasks = subtasks

	return output
}

func corsMiddleware(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}
