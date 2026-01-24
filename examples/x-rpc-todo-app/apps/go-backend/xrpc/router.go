package xrpc

import (
    "encoding/json"
    "net/http"
    "fmt"
)

type Router struct {
    middleware []MiddlewareFunc
    taskList TaskListHandler
    taskGet TaskGetHandler
    taskCreate TaskCreateHandler
    taskUpdate TaskUpdateHandler
    taskDelete TaskDeleteHandler
    subtaskAdd SubtaskAddHandler
    subtaskToggle SubtaskToggleHandler
    subtaskDelete SubtaskDeleteHandler
    tagAdd TagAddHandler
    tagRemove TagRemoveHandler
}
func NewRouter() *Router {
    return &Router{
        middleware: make([]MiddlewareFunc, 0),
    }
}
func (r *Router) TaskList(handler TaskListHandler) *Router {
    r.taskList = handler
    return r
}
func (r *Router) TaskGet(handler TaskGetHandler) *Router {
    r.taskGet = handler
    return r
}
func (r *Router) TaskCreate(handler TaskCreateHandler) *Router {
    r.taskCreate = handler
    return r
}
func (r *Router) TaskUpdate(handler TaskUpdateHandler) *Router {
    r.taskUpdate = handler
    return r
}
func (r *Router) TaskDelete(handler TaskDeleteHandler) *Router {
    r.taskDelete = handler
    return r
}
func (r *Router) SubtaskAdd(handler SubtaskAddHandler) *Router {
    r.subtaskAdd = handler
    return r
}
func (r *Router) SubtaskToggle(handler SubtaskToggleHandler) *Router {
    r.subtaskToggle = handler
    return r
}
func (r *Router) SubtaskDelete(handler SubtaskDeleteHandler) *Router {
    r.subtaskDelete = handler
    return r
}
func (r *Router) TagAdd(handler TagAddHandler) *Router {
    r.tagAdd = handler
    return r
}
func (r *Router) TagRemove(handler TagRemoveHandler) *Router {
    r.tagRemove = handler
    return r
}
func (r *Router) Use(middleware MiddlewareFunc) *Router {
    r.middleware = append(r.middleware, middleware)
    return r
}
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
    if req.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }

    var request struct {
        Method string          `json:"method"`
        Params json.RawMessage `json:"params"`
    }

    if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
        http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
        return
    }

    ctx := &Context{
        Request:        req,
        ResponseWriter: w,
        Data:           make(map[string]interface{}),
    }

    // Execute middleware chain
    for _, middleware := range r.middleware {
        result := middleware(ctx)
        if result.Error != nil {
            http.Error(w, fmt.Sprintf("Middleware error: %v", result.Error), http.StatusInternalServerError)
            return
        }
        if result.Response != nil {
            // Middleware short-circuited with response
            return
        }
        ctx = result.Context
    }

    switch request.Method {
        case "task.list":
            if r.taskList == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TaskListInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTaskListInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.taskList(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "task.get":
            if r.taskGet == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TaskGetInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTaskGetInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.taskGet(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "task.create":
            if r.taskCreate == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TaskCreateInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTaskCreateInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.taskCreate(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "task.update":
            if r.taskUpdate == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TaskUpdateInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTaskUpdateInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.taskUpdate(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "task.delete":
            if r.taskDelete == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TaskDeleteInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTaskDeleteInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.taskDelete(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "subtask.add":
            if r.subtaskAdd == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input SubtaskAddInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateSubtaskAddInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.subtaskAdd(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "subtask.toggle":
            if r.subtaskToggle == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input SubtaskToggleInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateSubtaskToggleInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.subtaskToggle(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "subtask.delete":
            if r.subtaskDelete == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input SubtaskDeleteInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateSubtaskDeleteInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.subtaskDelete(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "tag.add":
            if r.tagAdd == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TagAddInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTagAddInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.tagAdd(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        case "tag.remove":
            if r.tagRemove == nil {
                http.Error(w, "Handler not registered", http.StatusNotFound)
                return
            }

            var input TagRemoveInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateTagRemoveInput(input); err != nil {
                w.Header().Set("Content-Type", "application/json")
                w.WriteHeader(http.StatusBadRequest)
                if validationErrs, ok := err.(ValidationErrors); ok {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": "Validation failed",
                        "errors": validationErrs,
                    })
                } else {
                    json.NewEncoder(w).Encode(map[string]interface{}{
                        "error": err.Error(),
                    })
                }
                return
            }

            result, err := r.tagRemove(ctx, input)
            if err != nil {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(map[string]interface{}{"result": result})
            return
        default:
            http.Error(w, "Method not found", http.StatusNotFound)
            return
    }
}
