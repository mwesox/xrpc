package main

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type Todo struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	CreatedAt string `json:"createdAt"`
}

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

func (db *DB) ListTodos() ([]Todo, error) {
	rows, err := db.conn.Query("SELECT id, title, completed, created_at FROM todos ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var todos []Todo
	for rows.Next() {
		var t Todo
		var completed int
		if err := rows.Scan(&t.ID, &t.Title, &completed, &t.CreatedAt); err != nil {
			return nil, err
		}
		t.Completed = completed == 1
		todos = append(todos, t)
	}

	if todos == nil {
		todos = []Todo{}
	}
	return todos, nil
}

func (db *DB) CreateTodo(title string) (*Todo, error) {
	id := generateID()
	createdAt := time.Now().UTC().Format(time.RFC3339)

	_, err := db.conn.Exec(
		"INSERT INTO todos (id, title, completed, created_at) VALUES (?, ?, 0, ?)",
		id, title, createdAt,
	)
	if err != nil {
		return nil, err
	}

	return &Todo{
		ID:        id,
		Title:     title,
		Completed: false,
		CreatedAt: createdAt,
	}, nil
}

func (db *DB) ToggleTodo(id string) (*Todo, error) {
	_, err := db.conn.Exec("UPDATE todos SET completed = NOT completed WHERE id = ?", id)
	if err != nil {
		return nil, err
	}

	var t Todo
	var completed int
	err = db.conn.QueryRow("SELECT id, title, completed, created_at FROM todos WHERE id = ?", id).
		Scan(&t.ID, &t.Title, &completed, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	t.Completed = completed == 1

	return &t, nil
}

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
