package main

import (
	"log"
	"net/http"

	"go-backend/generated/server"
)

var db *DB

func main() {
	var err error
	db, err = NewDB("./todos.db")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Create xRPC router with type-safe handlers
	// Validation is automatically applied before handlers are called
	router := server.NewRouter().
		TodoList(handleTodoList).
		TodoCreate(handleTodoCreate).
		TodoToggle(handleTodoToggle).
		TodoDelete(handleTodoDelete)

	// Wrap with CORS middleware
	http.Handle("/api", corsMiddleware(router))

	log.Println("Go backend running on :8080")
	log.Println("Using generated xRPC router with automatic validation")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// Type-safe handlers using generated types
// Note: Input validation happens automatically in the router!
// If title is empty or >200 chars, router returns 400 with structured error

func handleTodoList(ctx *server.Context, input server.TodoListInput) (server.TodoListOutput, error) {
	return db.ListTodos()
}

func handleTodoCreate(ctx *server.Context, input server.TodoCreateInput) (server.TodoCreateOutput, error) {
	// input.Title is guaranteed to be 1-200 chars (validated by generated code)
	return db.CreateTodo(input.Title)
}

func handleTodoToggle(ctx *server.Context, input server.TodoToggleInput) (server.TodoToggleOutput, error) {
	// input.Id is guaranteed to be non-empty (validated by generated code)
	return db.ToggleTodo(input.Id)
}

func handleTodoDelete(ctx *server.Context, input server.TodoDeleteInput) (server.TodoDeleteOutput, error) {
	if err := db.DeleteTodo(input.Id); err != nil {
		return server.TodoDeleteOutput{}, err
	}
	return server.TodoDeleteOutput{Success: true}, nil
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
