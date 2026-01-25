package main

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"go-backend/xrpc"
)

type DB struct {
	conn *sql.DB
}

func NewDB(path string) (*DB, error) {
	conn, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	// Create tables if they don't exist
	_, err = conn.Exec(`
		CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'pending',
			priority TEXT NOT NULL DEFAULT 'medium',
			due_date TEXT,
			created_at TEXT NOT NULL,
			completed_at TEXT,
			estimated_hours REAL,
			position INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS subtasks (
			id TEXT PRIMARY KEY,
			task_id TEXT NOT NULL,
			title TEXT NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			task_id TEXT NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
			UNIQUE(task_id, name)
		);
	`)
	if err != nil {
		return nil, err
	}

	return &DB{conn: conn}, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func generateUUID() string {
	return uuid.New().String()
}

// =============================================================================
// TASK OPERATIONS
// =============================================================================

type TaskSummary struct {
	Id                    string
	Title                 string
	Status                string
	Priority              string
	DueDate               *string
	CreatedAt             string
	CompletedAt           *string
	SubtaskCount          int
	SubtaskCompletedCount int
	EstimatedHours        *float64
	Position              int
}

func (db *DB) ListTasks(status, priority *string, limit *int) ([]TaskSummary, int, error) {
	// Build query with optional filters
	query := `
		SELECT
			t.id, t.title, t.status, t.priority, t.due_date, t.created_at,
			t.completed_at, t.estimated_hours, t.position,
			(SELECT COUNT(*) FROM subtasks WHERE task_id = t.id) as subtask_count,
			(SELECT COUNT(*) FROM subtasks WHERE task_id = t.id AND completed = 1) as subtask_completed_count
		FROM tasks t
		WHERE 1=1
	`
	args := []interface{}{}

	if status != nil && *status != "" {
		query += " AND t.status = ?"
		args = append(args, *status)
	}
	if priority != nil && *priority != "" {
		query += " AND t.priority = ?"
		args = append(args, *priority)
	}

	query += " ORDER BY t.position ASC, t.created_at DESC"

	if limit != nil && *limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", *limit)
	}

	rows, err := db.conn.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tasks []TaskSummary
	for rows.Next() {
		var t TaskSummary
		err := rows.Scan(
			&t.Id, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.CreatedAt,
			&t.CompletedAt, &t.EstimatedHours, &t.Position,
			&t.SubtaskCount, &t.SubtaskCompletedCount,
		)
		if err != nil {
			return nil, 0, err
		}
		tasks = append(tasks, t)
	}

	// Get total count (without limit)
	var total int
	countQuery := "SELECT COUNT(*) FROM tasks WHERE 1=1"
	countArgs := []interface{}{}
	if status != nil && *status != "" {
		countQuery += " AND status = ?"
		countArgs = append(countArgs, *status)
	}
	if priority != nil && *priority != "" {
		countQuery += " AND priority = ?"
		countArgs = append(countArgs, *priority)
	}
	err = db.conn.QueryRow(countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

type FullTask struct {
	Id             string
	Title          string
	Description    *string
	Status         string
	Priority       string
	DueDate        *string
	CreatedAt      string
	CompletedAt    *string
	EstimatedHours *float64
	Position       int
	Subtasks       []Subtask
}

type Subtask struct {
	Id        string
	Title     string
	Completed bool
}

func (db *DB) GetTask(id string) (*FullTask, error) {
	task := &FullTask{}
	err := db.conn.QueryRow(`
		SELECT id, title, description, status, priority, due_date, created_at,
		       completed_at, estimated_hours, position
		FROM tasks WHERE id = ?
	`, id).Scan(
		&task.Id, &task.Title, &task.Description, &task.Status, &task.Priority,
		&task.DueDate, &task.CreatedAt, &task.CompletedAt, &task.EstimatedHours, &task.Position,
	)
	if err != nil {
		return nil, err
	}

	// Load subtasks
	subtaskRows, err := db.conn.Query("SELECT id, title, completed FROM subtasks WHERE task_id = ?", id)
	if err != nil {
		return nil, err
	}
	defer subtaskRows.Close()
	for subtaskRows.Next() {
		var st Subtask
		var completed int
		if err := subtaskRows.Scan(&st.Id, &st.Title, &completed); err != nil {
			return nil, err
		}
		st.Completed = completed == 1
		task.Subtasks = append(task.Subtasks, st)
	}

	return task, nil
}

func (db *DB) CreateTask(input xrpc.TaskCreateInput) (*FullTask, error) {
	id := generateUUID()
	createdAt := time.Now().UTC().Format(time.RFC3339)
	position := 0

	// Get next position
	err := db.conn.QueryRow("SELECT COALESCE(MAX(position), -1) + 1 FROM tasks").Scan(&position)
	if err != nil {
		return nil, err
	}

	_, err = db.conn.Exec(`
		INSERT INTO tasks (id, title, description, status, priority, due_date, created_at, estimated_hours, position)
		VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
	`, id, input.Title, input.Description, input.Priority, input.DueDate, createdAt, input.EstimatedHours, position)
	if err != nil {
		return nil, err
	}

	return db.GetTask(id)
}

func (db *DB) UpdateTask(input xrpc.TaskUpdateInput) (*FullTask, error) {
	// Build dynamic update query
	updates := []string{}
	args := []interface{}{}

	if input.Title != "" {
		updates = append(updates, "title = ?")
		args = append(args, input.Title)
	}
	if input.Description != nil {
		updates = append(updates, "description = ?")
		args = append(args, *input.Description)
	}
	if input.Status != "" {
		updates = append(updates, "status = ?")
		args = append(args, input.Status)
		// Set completed_at when status changes to completed
		if input.Status == "completed" {
			updates = append(updates, "completed_at = ?")
			args = append(args, time.Now().UTC().Format(time.RFC3339))
		} else if input.Status != "completed" {
			// Clear completed_at if status is no longer completed
			updates = append(updates, "completed_at = NULL")
		}
	}
	if input.Priority != "" {
		updates = append(updates, "priority = ?")
		args = append(args, input.Priority)
	}
	if input.DueDate != nil {
		if *input.DueDate == "" {
			updates = append(updates, "due_date = NULL")
		} else {
			updates = append(updates, "due_date = ?")
			args = append(args, *input.DueDate)
		}
	}
	if input.EstimatedHours != nil {
		if *input.EstimatedHours == 0 {
			updates = append(updates, "estimated_hours = NULL")
		} else {
			updates = append(updates, "estimated_hours = ?")
			args = append(args, *input.EstimatedHours)
		}
	}

	if len(updates) > 0 {
		query := "UPDATE tasks SET "
		for i, u := range updates {
			if i > 0 {
				query += ", "
			}
			query += u
		}
		query += " WHERE id = ?"
		args = append(args, input.Id)

		_, err := db.conn.Exec(query, args...)
		if err != nil {
			return nil, err
		}
	}

	return db.GetTask(input.Id)
}

func (db *DB) DeleteTask(id string) error {
	// Delete associated subtasks and tags first (or rely on CASCADE)
	_, err := db.conn.Exec("DELETE FROM subtasks WHERE task_id = ?", id)
	if err != nil {
		return err
	}
	_, err = db.conn.Exec("DELETE FROM tags WHERE task_id = ?", id)
	if err != nil {
		return err
	}
	_, err = db.conn.Exec("DELETE FROM tasks WHERE id = ?", id)
	return err
}

// =============================================================================
// SUBTASK OPERATIONS
// =============================================================================

func (db *DB) AddSubtask(taskId, title string) (*Subtask, error) {
	id := generateUUID()
	_, err := db.conn.Exec(
		"INSERT INTO subtasks (id, task_id, title, completed) VALUES (?, ?, ?, 0)",
		id, taskId, title,
	)
	if err != nil {
		return nil, err
	}

	return &Subtask{
		Id:        id,
		Title:     title,
		Completed: false,
	}, nil
}

func (db *DB) ToggleSubtask(taskId, subtaskId string) (*Subtask, error) {
	_, err := db.conn.Exec(
		"UPDATE subtasks SET completed = NOT completed WHERE id = ? AND task_id = ?",
		subtaskId, taskId,
	)
	if err != nil {
		return nil, err
	}

	var st Subtask
	var completed int
	err = db.conn.QueryRow(
		"SELECT id, title, completed FROM subtasks WHERE id = ? AND task_id = ?",
		subtaskId, taskId,
	).Scan(&st.Id, &st.Title, &completed)
	if err != nil {
		return nil, err
	}
	st.Completed = completed == 1

	return &st, nil
}

