package server

import "net/http"

type Context struct {
    Request        *http.Request
    ResponseWriter http.ResponseWriter
    Data           map[string]interface{}
}


// GetUserId retrieves userId from context if set by middlewarefunc GetUserId(ctx *Context) (string, bool) {
    if val, ok := ctx.Data["userId"].(string); ok {
        return val, true
    }
    return "", false
}


// GetSessionId retrieves sessionId from context if set by middlewarefunc GetSessionId(ctx *Context) (string, bool) {
    if val, ok := ctx.Data["sessionId"].(string); ok {
        return val, true
    }
    return "", false
}


type GreetingGreetInput struct {
    Name string `json:"name"`
}

type GreetingGreetOutput struct {
    Message string `json:"message"`
}
