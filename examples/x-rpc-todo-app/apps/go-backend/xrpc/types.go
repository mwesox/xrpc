package xrpc

import "net/http"

type Context struct {
    Request        *http.Request
    ResponseWriter http.ResponseWriter
    Data           map[string]interface{}
}


// GetUserId retrieves userId from context if set by middleware
func GetUserId(ctx *Context) (string, bool) {
    if val, ok := ctx.Data["userId"].(string); ok {
        return val, true
    }
    return "", false
}


// GetSessionId retrieves sessionId from context if set by middleware
func GetSessionId(ctx *Context) (string, bool) {
    if val, ok := ctx.Data["sessionId"].(string); ok {
        return val, true
    }
    return "", false
}


// MiddlewareFunc is a function that processes a request and extends context

type MiddlewareFunc func(ctx *Context) *MiddlewareResult


type MiddlewareResult struct {
    Context  *Context
    Error    error
    Response *http.Response
}


// NewMiddlewareResult creates a successful middleware result
func NewMiddlewareResult(ctx *Context) *MiddlewareResult {
    return &MiddlewareResult{Context: ctx}
}


// NewMiddlewareError creates a middleware result with an error
func NewMiddlewareError(err error) *MiddlewareResult {
    return &MiddlewareResult{Error: err}
}


// NewMiddlewareResponse creates a middleware result that short-circuits with a response
func NewMiddlewareResponse(resp *http.Response) *MiddlewareResult {
    return &MiddlewareResult{Response: resp}
}


type TaskListInput struct {
    Status string `json:"status,omitempty"`
    Priority string `json:"priority,omitempty"`
    Limit float64 `json:"limit,omitempty"`
}

type TaskListOutput struct {
    Tasks []TaskListOutputTasksItem `json:"tasks"`
    Total float64 `json:"total"`
}

type TaskGetInput struct {
    Id string `json:"id"`
}

type TaskGetOutput struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Description string `json:"description,omitempty"`
    Status string `json:"status"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    CreatedAt string `json:"createdAt"`
    CompletedAt *string `json:"completedAt"`
    Assignee TaskGetOutputAssignee `json:"assignee,omitempty"`
    Subtasks []TaskGetOutputSubtasksItem `json:"subtasks"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
    Position float64 `json:"position"`
}

type TaskCreateInput struct {
    Title string `json:"title"`
    Description string `json:"description,omitempty"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
}

type TaskCreateOutput struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Description string `json:"description,omitempty"`
    Status string `json:"status"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    CreatedAt string `json:"createdAt"`
    CompletedAt *string `json:"completedAt"`
    Assignee TaskCreateOutputAssignee `json:"assignee,omitempty"`
    Subtasks []TaskCreateOutputSubtasksItem `json:"subtasks"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
    Position float64 `json:"position"`
}

type TaskUpdateInput struct {
    Id string `json:"id"`
    Title string `json:"title,omitempty"`
    Description *string `json:"description"`
    Status string `json:"status,omitempty"`
    Priority string `json:"priority,omitempty"`
    DueDate *string `json:"dueDate"`
    EstimatedHours *float64 `json:"estimatedHours"`
}

type TaskUpdateOutput struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Description string `json:"description,omitempty"`
    Status string `json:"status"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    CreatedAt string `json:"createdAt"`
    CompletedAt *string `json:"completedAt"`
    Assignee TaskUpdateOutputAssignee `json:"assignee,omitempty"`
    Subtasks []TaskUpdateOutputSubtasksItem `json:"subtasks"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
    Position float64 `json:"position"`
}

type TaskDeleteInput struct {
    Id string `json:"id"`
}

type TaskDeleteOutput struct {
    Success bool `json:"success"`
}

type SubtaskAddInput struct {
    TaskId string `json:"taskId"`
    Title string `json:"title"`
}

type SubtaskAddOutput struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Completed bool `json:"completed"`
}

type SubtaskToggleInput struct {
    TaskId string `json:"taskId"`
    SubtaskId string `json:"subtaskId"`
}

type SubtaskToggleOutput struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Completed bool `json:"completed"`
}

type TaskListOutputTasksItem struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Status string `json:"status"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    CreatedAt string `json:"createdAt"`
    CompletedAt *string `json:"completedAt"`
    SubtaskCount float64 `json:"subtaskCount"`
    SubtaskCompletedCount float64 `json:"subtaskCompletedCount"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
    Position float64 `json:"position"`
}

type TaskGetOutputAssignee struct {
    Id string `json:"id"`
    Name string `json:"name"`
    Email string `json:"email"`
}

type TaskGetOutputSubtasksItem struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Completed bool `json:"completed"`
}

type TaskCreateOutputAssignee struct {
    Id string `json:"id"`
    Name string `json:"name"`
    Email string `json:"email"`
}

type TaskCreateOutputSubtasksItem struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Completed bool `json:"completed"`
}

type TaskUpdateOutputAssignee struct {
    Id string `json:"id"`
    Name string `json:"name"`
    Email string `json:"email"`
}

type TaskUpdateOutputSubtasksItem struct {
    Id string `json:"id"`
    Title string `json:"title"`
    Completed bool `json:"completed"`
}

// Typed handler types for each endpoint

// Handler type for task.list
type TaskListHandler func(ctx *Context, input TaskListInput) (TaskListOutput, error)


// Handler type for task.get
type TaskGetHandler func(ctx *Context, input TaskGetInput) (TaskGetOutput, error)


// Handler type for task.create
type TaskCreateHandler func(ctx *Context, input TaskCreateInput) (TaskCreateOutput, error)


// Handler type for task.update
type TaskUpdateHandler func(ctx *Context, input TaskUpdateInput) (TaskUpdateOutput, error)


// Handler type for task.delete
type TaskDeleteHandler func(ctx *Context, input TaskDeleteInput) (TaskDeleteOutput, error)


// Handler type for subtask.add
type SubtaskAddHandler func(ctx *Context, input SubtaskAddInput) (SubtaskAddOutput, error)


// Handler type for subtask.toggle
type SubtaskToggleHandler func(ctx *Context, input SubtaskToggleInput) (SubtaskToggleOutput, error)

