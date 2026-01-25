package xrpc

import (
    "fmt"
    "strings"
    "regexp"
    "net/mail"
)

type ValidationError struct {
    Field   string `json:"field"`
    Message string `json:"message"`
}


type ValidationErrors []*ValidationError

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

func (e ValidationErrors) Error() string {
    var msgs []string
    for _, err := range e {
        msgs = append(msgs, err.Error())
    }
    return strings.Join(msgs, "; ")
}

func ValidateTaskListInput(input TaskListInput) error {
    var errs ValidationErrors
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    if input.Limit < 1 {
        errs = append(errs, &ValidationError{
            Field:   "limit",
            Message: fmt.Sprintf("must be at least %v", 1),
        })
    }
    if input.Limit > 50 {
        errs = append(errs, &ValidationError{
            Field:   "limit",
            Message: fmt.Sprintf("must be at most %v", 50),
        })
    }
    if float64(input.Limit) != float64(int64(input.Limit)) {
        errs = append(errs, &ValidationError{
            Field:   "limit",
            Message: "must be an integer",
        })
    }
    if input.Limit <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "limit",
            Message: "must be positive",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskListOutput(input TaskListOutput) error {
    var errs ValidationErrors
    // Validate tasks
    if input.Tasks == nil {
        errs = append(errs, &ValidationError{
            Field:   "tasks",
            Message: "is required",
        })
    }
    for i, item := range input.Tasks {
        if err := ValidateTaskListOutputTasksItem(item); err != nil {
            if nestedErrs, ok := err.(ValidationErrors); ok {
                for _, nestedErr := range nestedErrs {
                    errs = append(errs, &ValidationError{
                        Field:   fmt.Sprintf("tasks[%%d].%%s", i, nestedErr.Field),
                        Message: nestedErr.Message,
                    })
                }
            }
        }
    }
    // Validate total
    if input.Total < 0 {
        errs = append(errs, &ValidationError{
            Field:   "total",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.Total) != float64(int64(input.Total)) {
        errs = append(errs, &ValidationError{
            Field:   "total",
            Message: "must be an integer",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskGetInput(input TaskGetInput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskGetOutput(input TaskGetOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    if input.Description != "" {
        if len(input.Description) > 2000 {
            errs = append(errs, &ValidationError{
                Field:   "description",
                Message: fmt.Sprintf("must be at most %d character(s)", 2000),
            })
        }
    }
    // Validate status
    if input.Status == "" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "is required",
        })
    }
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    // Validate priority
    if input.Priority == "" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "is required",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    // Validate createdAt
    if input.CreatedAt == "" {
        errs = append(errs, &ValidationError{
            Field:   "createdAt",
            Message: "is required",
        })
    }
    // Validate completedAt (skipped - pointer type)
    // Validate subtasks
    if input.Subtasks == nil {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: "is required",
        })
    }
    if input.Subtasks != nil && len(input.Subtasks) > 20 {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: fmt.Sprintf("must have at most %d item(s)", 20),
        })
    }
    for i, item := range input.Subtasks {
        if err := ValidateTaskGetOutputSubtasksItem(item); err != nil {
            if nestedErrs, ok := err.(ValidationErrors); ok {
                for _, nestedErr := range nestedErrs {
                    errs = append(errs, &ValidationError{
                        Field:   fmt.Sprintf("subtasks[%%d].%%s", i, nestedErr.Field),
                        Message: nestedErr.Message,
                    })
                }
            }
        }
    }
    if input.EstimatedHours > 100 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: fmt.Sprintf("must be at most %v", 100),
        })
    }
    if input.EstimatedHours <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: "must be positive",
        })
    }
    // Validate position
    if input.Position < 0 {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.Position) != float64(int64(input.Position)) {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: "must be an integer",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskCreateInput(input TaskCreateInput) error {
    var errs ValidationErrors
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 3 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 3),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    if input.Description != "" {
        if len(input.Description) > 2000 {
            errs = append(errs, &ValidationError{
                Field:   "description",
                Message: fmt.Sprintf("must be at most %d character(s)", 2000),
            })
        }
    }
    // Validate priority
    if input.Priority == "" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "is required",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    if input.EstimatedHours > 100 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: fmt.Sprintf("must be at most %v", 100),
        })
    }
    if input.EstimatedHours <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: "must be positive",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskCreateOutput(input TaskCreateOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    if input.Description != "" {
        if len(input.Description) > 2000 {
            errs = append(errs, &ValidationError{
                Field:   "description",
                Message: fmt.Sprintf("must be at most %d character(s)", 2000),
            })
        }
    }
    // Validate status
    if input.Status == "" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "is required",
        })
    }
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    // Validate priority
    if input.Priority == "" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "is required",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    // Validate createdAt
    if input.CreatedAt == "" {
        errs = append(errs, &ValidationError{
            Field:   "createdAt",
            Message: "is required",
        })
    }
    // Validate completedAt (skipped - pointer type)
    // Validate subtasks
    if input.Subtasks == nil {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: "is required",
        })
    }
    if input.Subtasks != nil && len(input.Subtasks) > 20 {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: fmt.Sprintf("must have at most %d item(s)", 20),
        })
    }
    for i, item := range input.Subtasks {
        if err := ValidateTaskCreateOutputSubtasksItem(item); err != nil {
            if nestedErrs, ok := err.(ValidationErrors); ok {
                for _, nestedErr := range nestedErrs {
                    errs = append(errs, &ValidationError{
                        Field:   fmt.Sprintf("subtasks[%%d].%%s", i, nestedErr.Field),
                        Message: nestedErr.Message,
                    })
                }
            }
        }
    }
    if input.EstimatedHours > 100 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: fmt.Sprintf("must be at most %v", 100),
        })
    }
    if input.EstimatedHours <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: "must be positive",
        })
    }
    // Validate position
    if input.Position < 0 {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.Position) != float64(int64(input.Position)) {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: "must be an integer",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskUpdateInput(input TaskUpdateInput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    if input.Title != "" {
        if len(input.Title) < 1 {
            errs = append(errs, &ValidationError{
                Field:   "title",
                Message: fmt.Sprintf("must be at least %d character(s)", 1),
            })
        }
        if len(input.Title) > 200 {
            errs = append(errs, &ValidationError{
                Field:   "title",
                Message: fmt.Sprintf("must be at most %d character(s)", 200),
            })
        }
    }
    // Validate description (skipped - pointer type)
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    // Validate dueDate (skipped - pointer type)
    // Validate estimatedHours (skipped - pointer type)
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskUpdateOutput(input TaskUpdateOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    if input.Description != "" {
        if len(input.Description) > 2000 {
            errs = append(errs, &ValidationError{
                Field:   "description",
                Message: fmt.Sprintf("must be at most %d character(s)", 2000),
            })
        }
    }
    // Validate status
    if input.Status == "" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "is required",
        })
    }
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    // Validate priority
    if input.Priority == "" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "is required",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    // Validate createdAt
    if input.CreatedAt == "" {
        errs = append(errs, &ValidationError{
            Field:   "createdAt",
            Message: "is required",
        })
    }
    // Validate completedAt (skipped - pointer type)
    // Validate subtasks
    if input.Subtasks == nil {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: "is required",
        })
    }
    if input.Subtasks != nil && len(input.Subtasks) > 20 {
        errs = append(errs, &ValidationError{
            Field:   "subtasks",
            Message: fmt.Sprintf("must have at most %d item(s)", 20),
        })
    }
    for i, item := range input.Subtasks {
        if err := ValidateTaskUpdateOutputSubtasksItem(item); err != nil {
            if nestedErrs, ok := err.(ValidationErrors); ok {
                for _, nestedErr := range nestedErrs {
                    errs = append(errs, &ValidationError{
                        Field:   fmt.Sprintf("subtasks[%%d].%%s", i, nestedErr.Field),
                        Message: nestedErr.Message,
                    })
                }
            }
        }
    }
    if input.EstimatedHours > 100 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: fmt.Sprintf("must be at most %v", 100),
        })
    }
    if input.EstimatedHours <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: "must be positive",
        })
    }
    // Validate position
    if input.Position < 0 {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.Position) != float64(int64(input.Position)) {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: "must be an integer",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskDeleteInput(input TaskDeleteInput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskDeleteOutput(input TaskDeleteOutput) error {
    var errs ValidationErrors
    // Validate success
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateSubtaskAddInput(input SubtaskAddInput) error {
    var errs ValidationErrors
    // Validate taskId
    if input.TaskId == "" {
        errs = append(errs, &ValidationError{
            Field:   "taskId",
            Message: "is required",
        })
    }
    if input.TaskId != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.TaskId)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "taskId",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateSubtaskAddOutput(input SubtaskAddOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate completed
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateSubtaskToggleInput(input SubtaskToggleInput) error {
    var errs ValidationErrors
    // Validate taskId
    if input.TaskId == "" {
        errs = append(errs, &ValidationError{
            Field:   "taskId",
            Message: "is required",
        })
    }
    if input.TaskId != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.TaskId)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "taskId",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate subtaskId
    if input.SubtaskId == "" {
        errs = append(errs, &ValidationError{
            Field:   "subtaskId",
            Message: "is required",
        })
    }
    if input.SubtaskId != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.SubtaskId)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "subtaskId",
                Message: "must be a valid UUID",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateSubtaskToggleOutput(input SubtaskToggleOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate completed
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskListOutputTasksItem(input TaskListOutputTasksItem) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate status
    if input.Status == "" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "is required",
        })
    }
    if input.Status != "" && input.Status != "pending" && input.Status != "in_progress" && input.Status != "completed" && input.Status != "cancelled" {
        errs = append(errs, &ValidationError{
            Field:   "status",
            Message: "must be one of: pending, in_progress, completed, cancelled",
        })
    }
    // Validate priority
    if input.Priority == "" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "is required",
        })
    }
    if input.Priority != "" && input.Priority != "low" && input.Priority != "medium" && input.Priority != "high" && input.Priority != "urgent" {
        errs = append(errs, &ValidationError{
            Field:   "priority",
            Message: "must be one of: low, medium, high, urgent",
        })
    }
    // Validate createdAt
    if input.CreatedAt == "" {
        errs = append(errs, &ValidationError{
            Field:   "createdAt",
            Message: "is required",
        })
    }
    // Validate completedAt (skipped - pointer type)
    // Validate subtaskCount
    if input.SubtaskCount < 0 {
        errs = append(errs, &ValidationError{
            Field:   "subtaskCount",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.SubtaskCount) != float64(int64(input.SubtaskCount)) {
        errs = append(errs, &ValidationError{
            Field:   "subtaskCount",
            Message: "must be an integer",
        })
    }
    // Validate subtaskCompletedCount
    if input.SubtaskCompletedCount < 0 {
        errs = append(errs, &ValidationError{
            Field:   "subtaskCompletedCount",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.SubtaskCompletedCount) != float64(int64(input.SubtaskCompletedCount)) {
        errs = append(errs, &ValidationError{
            Field:   "subtaskCompletedCount",
            Message: "must be an integer",
        })
    }
    if input.EstimatedHours > 100 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: fmt.Sprintf("must be at most %v", 100),
        })
    }
    if input.EstimatedHours <= 0 {
        errs = append(errs, &ValidationError{
            Field:   "estimatedHours",
            Message: "must be positive",
        })
    }
    // Validate position
    if input.Position < 0 {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: fmt.Sprintf("must be at least %v", 0),
        })
    }
    if float64(input.Position) != float64(int64(input.Position)) {
        errs = append(errs, &ValidationError{
            Field:   "position",
            Message: "must be an integer",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskGetOutputAssignee(input TaskGetOutputAssignee) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if input.Name != "" && len(input.Name) < 2 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at least %d character(s)", 2),
        })
    }
    if len(input.Name) > 100 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at most %d character(s)", 100),
        })
    }
    // Validate email
    if input.Email == "" {
        errs = append(errs, &ValidationError{
            Field:   "email",
            Message: "is required",
        })
    }
    if input.Email != "" {
        if _, err := mail.ParseAddress(input.Email); err != nil {
            errs = append(errs, &ValidationError{
                Field:   "email",
                Message: "must be a valid email address",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskGetOutputSubtasksItem(input TaskGetOutputSubtasksItem) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate completed
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskCreateOutputAssignee(input TaskCreateOutputAssignee) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if input.Name != "" && len(input.Name) < 2 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at least %d character(s)", 2),
        })
    }
    if len(input.Name) > 100 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at most %d character(s)", 100),
        })
    }
    // Validate email
    if input.Email == "" {
        errs = append(errs, &ValidationError{
            Field:   "email",
            Message: "is required",
        })
    }
    if input.Email != "" {
        if _, err := mail.ParseAddress(input.Email); err != nil {
            errs = append(errs, &ValidationError{
                Field:   "email",
                Message: "must be a valid email address",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskCreateOutputSubtasksItem(input TaskCreateOutputSubtasksItem) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate completed
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskUpdateOutputAssignee(input TaskUpdateOutputAssignee) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if input.Name != "" && len(input.Name) < 2 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at least %d character(s)", 2),
        })
    }
    if len(input.Name) > 100 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at most %d character(s)", 100),
        })
    }
    // Validate email
    if input.Email == "" {
        errs = append(errs, &ValidationError{
            Field:   "email",
            Message: "is required",
        })
    }
    if input.Email != "" {
        if _, err := mail.ParseAddress(input.Email); err != nil {
            errs = append(errs, &ValidationError{
                Field:   "email",
                Message: "must be a valid email address",
            })
        }
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateTaskUpdateOutputSubtasksItem(input TaskUpdateOutputSubtasksItem) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    if input.Id != "" {
        matched, _ := regexp.MatchString("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", input.Id)

        if !matched {
            errs = append(errs, &ValidationError{
                Field:   "id",
                Message: "must be a valid UUID",
            })
        }
    }
    // Validate title
    if input.Title == "" {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: "is required",
        })
    }
    if input.Title != "" && len(input.Title) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Title) > 200 {
        errs = append(errs, &ValidationError{
            Field:   "title",
            Message: fmt.Sprintf("must be at most %d character(s)", 200),
        })
    }
    // Validate completed
    if len(errs) > 0 {
        return errs
    }
    return nil
}

