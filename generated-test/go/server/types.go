package server

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


type GreetingGreetInput struct {
    Name string `json:"name"`
    Email string `json:"email,omitempty"`
}

type GreetingGreetOutput struct {
    Message string `json:"message"`
}

type GreetingCreateUserInput struct {
    Name string `json:"name"`
    Email string `json:"email"`
    Age float64 `json:"age"`
    Tags []string `json:"tags"`
}

type GreetingCreateUserOutput struct {
    Id string `json:"id"`
    Name string `json:"name"`
}
