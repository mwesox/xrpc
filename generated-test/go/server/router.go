package server

import (
    "encoding/json"
    "net/http"
    "fmt"
)

type QueryHandler func(ctx *Context, input interface{}) (interface{}, error)

type MutationHandler func(ctx *Context, input interface{}) (interface{}, error)

type Router struct {
    queryHandlers    map[string]QueryHandler
    mutationHandlers map[string]MutationHandler
    middleware       []MiddlewareFunc
}
func NewRouter() *Router {
    return &Router{
        queryHandlers:    make(map[string]QueryHandler),
        mutationHandlers: make(map[string]MutationHandler),
        middleware:       make([]MiddlewareFunc, 0),
    }
}
func (r *Router) Query(name string, handler QueryHandler) {
    r.queryHandlers[name] = handler
}
func (r *Router) Mutation(name string, handler MutationHandler) {
    r.mutationHandlers[name] = handler
}
func (r *Router) Use(middleware MiddlewareFunc) {
    r.middleware = append(r.middleware, middleware)
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

    var handler interface{}
    var ok bool

    switch request.Method {
        case "greeting.greet":
            handler, ok = r.queryHandlers["greeting.greet"]
            if !ok {
                http.Error(w, "Handler not found", http.StatusNotFound)
                return
            }

            var input GreetingGreetInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateGreetingGreetInput(input); err != nil {
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

            queryHandler := handler.(QueryHandler)
            result, err := queryHandler(ctx, input)
            if err != nil {
                http.Error(w, fmt.Sprintf("Handler error: %v", err), http.StatusInternalServerError)
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(result)
            return
        case "greeting.createUser":
            handler, ok = r.mutationHandlers["greeting.createUser"]
            if !ok {
                http.Error(w, "Handler not found", http.StatusNotFound)
                return
            }

            var input GreetingCreateUserInput
            if err := json.Unmarshal(request.Params, &input); err != nil {
                http.Error(w, fmt.Sprintf("Invalid params: %v", err), http.StatusBadRequest)
                return
            }

            if err := ValidateGreetingCreateUserInput(input); err != nil {
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

            mutationHandler := handler.(MutationHandler)
            result, err := mutationHandler(ctx, input)
            if err != nil {
                http.Error(w, fmt.Sprintf("Handler error: %v", err), http.StatusInternalServerError)
                return
            }

            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(result)
            return
        default:
            http.Error(w, "Method not found", http.StatusNotFound)
            return
    }
}
