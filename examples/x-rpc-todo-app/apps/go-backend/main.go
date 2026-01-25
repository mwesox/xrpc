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
		SubtaskToggle(handleSubtaskToggle)

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

	// Convert to output format using properly typed structs
	outputTasks := make([]xrpc.TaskListOutputTasksItem, len(tasks))
	for i, t := range tasks {
		item := xrpc.TaskListOutputTasksItem{
			Id:                    t.Id,
			Title:                 t.Title,
			Status:                t.Status,
			Priority:              t.Priority,
			CreatedAt:             t.CreatedAt,
			SubtaskCount:          float64(t.SubtaskCount),
			SubtaskCompletedCount: float64(t.SubtaskCompletedCount),
			Position:              float64(t.Position),
		}
		if t.DueDate != nil {
			item.DueDate = *t.DueDate
		}
		if t.CompletedAt != nil {
			item.CompletedAt = t.CompletedAt
		}
		if t.EstimatedHours != nil {
			item.EstimatedHours = *t.EstimatedHours
		}
		outputTasks[i] = item
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

	return taskToGetOutput(task), nil
}

func handleTaskCreate(ctx *xrpc.Context, input xrpc.TaskCreateInput) (xrpc.TaskCreateOutput, error) {
	task, err := db.CreateTask(input)
	if err != nil {
		return xrpc.TaskCreateOutput{}, err
	}

	return taskToCreateOutput(task), nil
}

func handleTaskUpdate(ctx *xrpc.Context, input xrpc.TaskUpdateInput) (xrpc.TaskUpdateOutput, error) {
	task, err := db.UpdateTask(input)
	if err != nil {
		return xrpc.TaskUpdateOutput{}, err
	}

	return taskToUpdateOutput(task), nil
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

func taskToGetOutput(task *FullTask) xrpc.TaskGetOutput {
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

	// Convert subtasks using properly typed struct
	subtasks := make([]xrpc.TaskGetOutputSubtasksItem, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = xrpc.TaskGetOutputSubtasksItem{
			Id:        s.Id,
			Title:     s.Title,
			Completed: s.Completed,
		}
	}
	output.Subtasks = subtasks

	return output
}

func taskToCreateOutput(task *FullTask) xrpc.TaskCreateOutput {
	output := xrpc.TaskCreateOutput{
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

	// Convert subtasks using properly typed struct
	subtasks := make([]xrpc.TaskCreateOutputSubtasksItem, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = xrpc.TaskCreateOutputSubtasksItem{
			Id:        s.Id,
			Title:     s.Title,
			Completed: s.Completed,
		}
	}
	output.Subtasks = subtasks

	return output
}

func taskToUpdateOutput(task *FullTask) xrpc.TaskUpdateOutput {
	output := xrpc.TaskUpdateOutput{
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

	// Convert subtasks using properly typed struct
	subtasks := make([]xrpc.TaskUpdateOutputSubtasksItem, len(task.Subtasks))
	for i, s := range task.Subtasks {
		subtasks[i] = xrpc.TaskUpdateOutputSubtasksItem{
			Id:        s.Id,
			Title:     s.Title,
			Completed: s.Completed,
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
