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
    Tasks []interface{} `json:"tasks"`
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
    Assignee interface{} `json:"assignee,omitempty"`
    Tags []interface{} `json:"tags"`
    Subtasks []interface{} `json:"subtasks"`
    EstimatedHours float64 `json:"estimatedHours,omitempty"`
    Position float64 `json:"position"`
}

type TaskCreateInput struct {
    Title string `json:"title"`
    Description string `json:"description,omitempty"`
    Priority string `json:"priority"`
    DueDate string `json:"dueDate,omitempty"`
    Tags []interface{} `json:"tags,omitempty"`
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
    Assignee interface{} `json:"assignee,omitempty"`
    Tags []interface{} `json:"tags"`
    Subtasks []interface{} `json:"subtasks"`
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
    Assignee interface{} `json:"assignee,omitempty"`
    Tags []interface{} `json:"tags"`
    Subtasks []interface{} `json:"subtasks"`
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

type SubtaskDeleteInput struct {
    TaskId string `json:"taskId"`
    SubtaskId string `json:"subtaskId"`
}

type SubtaskDeleteOutput struct {
    Success bool `json:"success"`
}

type TagAddInput struct {
    TaskId string `json:"taskId"`
    Name string `json:"name"`
    Color string `json:"color"`
}

type TagAddOutput struct {
    Name string `json:"name"`
    Color string `json:"color"`
}

type TagRemoveInput struct {
    TaskId string `json:"taskId"`
    TagName string `json:"tagName"`
}

type TagRemoveOutput struct {
    Success bool `json:"success"`
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


// Handler type for subtask.delete
type SubtaskDeleteHandler func(ctx *Context, input SubtaskDeleteInput) (SubtaskDeleteOutput, error)


// Handler type for tag.add
type TagAddHandler func(ctx *Context, input TagAddInput) (TagAddOutput, error)


// Handler type for tag.remove
type TagRemoveHandler func(ctx *Context, input TagRemoveInput) (TagRemoveOutput, error)

