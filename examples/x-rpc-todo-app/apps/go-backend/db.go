package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go-backend/generated/server"
)

type DB struct {
	conn *sql.DB
}

func NewDB(path string) (*DB, error) {
	conn, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	// Create todos table if it doesn't exist
	_, err = conn.Exec(`
		CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL
		)
	`)
	if err != nil {
		return nil, err
	}

	return &DB{conn: conn}, nil
}

// ListTodos returns all todos using the generated TodoListOutput type
func (db *DB) ListTodos() (server.TodoListOutput, error) {
	rows, err := db.conn.Query("SELECT id, title, completed, created_at FROM todos ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos server.TodoListOutput
	for rows.Next() {
		var t server.TodoListOutputItem
		var completed int
		if err := rows.Scan(&t.Id, &t.Title, &completed, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.Completed = completed == 1
		todos = append(todos, t)
	}

	if todos == nil {
		todos = server.TodoListOutput{}
	}
	return todos, nil
}

// CreateTodo creates a new todo and returns the generated TodoCreateOutput type
func (db *DB) CreateTodo(title string) (server.TodoCreateOutput, error) {
	id := generateID()
	createdAt := time.Now().UTC().Format(time.RFC3339)

	_, err := db.conn.Exec(
		"INSERT INTO todos (id, title, completed, created_at) VALUES (?, ?, 0, ?)",
		id, title, createdAt,
	)
	if err != nil {
		return server.TodoCreateOutput{}, err
	}

	return server.TodoCreateOutput{
		Id:        id,
		Title:     title,
		Completed: false,
		CreatedAt: createdAt,
	}, nil
}

// ToggleTodo toggles a todo's completed status and returns the generated TodoToggleOutput type
func (db *DB) ToggleTodo(id string) (server.TodoToggleOutput, error) {
	_, err := db.conn.Exec("UPDATE todos SET completed = NOT completed WHERE id = ?", id)
	if err != nil {
		return server.TodoToggleOutput{}, err
	}

	var t server.TodoToggleOutput
	var completed int
	err = db.conn.QueryRow("SELECT id, title, completed, created_at FROM todos WHERE id = ?", id).
		Scan(&t.Id, &t.Title, &completed, &t.CreatedAt)
	if err != nil {
		return server.TodoToggleOutput{}, err
	}
	t.Completed = completed == 1

	return t, nil
}

// DeleteTodo removes a todo from the database
func (db *DB) DeleteTodo(id string) error {
	_, err := db.conn.Exec("DELETE FROM todos WHERE id = ?", id)
	return err
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
