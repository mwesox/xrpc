package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

var db *DB

func main() {
	var err error
	db, err = NewDB("./todos.db")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	http.HandleFunc("/api", corsMiddleware(handleRPC))

	log.Println("Go backend running on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

type RPCRequest struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type RPCResponse struct {
	Result interface{} `json:"result,omitempty"`
	Error  string      `json:"error,omitempty"`
}

func handleRPC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RPCRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, "Invalid request: "+err.Error())
		return
	}

	var result interface{}
	var err error

	switch req.Method {
	case "todo.list":
		result, err = handleTodoList()
	case "todo.create":
		result, err = handleTodoCreate(req.Params)
	case "todo.toggle":
		result, err = handleTodoToggle(req.Params)
	case "todo.delete":
		result, err = handleTodoDelete(req.Params)
	default:
		sendError(w, "Method not found: "+req.Method)
		return
	}

	if err != nil {
		sendError(w, err.Error())
		return
	}

	sendSuccess(w, result)
}

func handleTodoList() ([]Todo, error) {
	return db.ListTodos()
}

type CreateInput struct {
	Title string `json:"title"`
}

func handleTodoCreate(params json.RawMessage) (*Todo, error) {
	var input CreateInput
	if err := json.Unmarshal(params, &input); err != nil {
		return nil, fmt.Errorf("invalid params: %v", err)
	}
	return db.CreateTodo(input.Title)
}

type ToggleInput struct {
	ID string `json:"id"`
}

func handleTodoToggle(params json.RawMessage) (*Todo, error) {
	var input ToggleInput
	if err := json.Unmarshal(params, &input); err != nil {
		return nil, fmt.Errorf("invalid params: %v", err)
	}
	return db.ToggleTodo(input.ID)
}

type DeleteInput struct {
	ID string `json:"id"`
}

type DeleteResult struct {
	Success bool `json:"success"`
}

func handleTodoDelete(params json.RawMessage) (*DeleteResult, error) {
	var input DeleteInput
	if err := json.Unmarshal(params, &input); err != nil {
		return nil, fmt.Errorf("invalid params: %v", err)
	}
	if err := db.DeleteTodo(input.ID); err != nil {
		return nil, err
	}
	return &DeleteResult{Success: true}, nil
}

func sendSuccess(w http.ResponseWriter, result interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RPCResponse{Result: result})
}

func sendError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(RPCResponse{Error: message})
}
