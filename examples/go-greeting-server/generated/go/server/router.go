package server

import (
    "context"
    "encoding/json"
    "net/http"
    "fmt"
)

type QueryHandler func(ctx context.Context, input interface{}) (interface{}, error)

type MutationHandler func(ctx context.Context, input interface{}) (interface{}, error)

type Router struct {
    queryHandlers    map[string]QueryHandler
    mutationHandlers map[string]MutationHandler
}
func NewRouter() *Router {
    return &Router{
        queryHandlers:    make(map[string]QueryHandler),
        mutationHandlers: make(map[string]MutationHandler),
    }
}
func (r *Router) Query(name string, handler QueryHandler) {
    r.queryHandlers[name] = handler
}
func (r *Router) Mutation(name string, handler MutationHandler) {
    r.mutationHandlers[name] = handler
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

    ctx := req.Context()

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

            queryHandler := handler.(QueryHandler)
            result, err := queryHandler(ctx, input)
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
