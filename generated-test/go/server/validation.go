package server

import (
    "fmt"
    "strings"
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

func ValidateGreetingGreetInput(input GreetingGreetInput) error {
    var errs ValidationErrors
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if input.Name != "" && len(input.Name) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at least %d character(s)", 1),
        })
    }
    if len(input.Name) > 100 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at most %d character(s)", 100),
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

func ValidateGreetingGreetOutput(input GreetingGreetOutput) error {
    var errs ValidationErrors
    // Validate message
    if input.Message == "" {
        errs = append(errs, &ValidationError{
            Field:   "message",
            Message: "is required",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateGreetingCreateUserInput(input GreetingCreateUserInput) error {
    var errs ValidationErrors
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if input.Name != "" && len(input.Name) < 3 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at least %d character(s)", 3),
        })
    }
    if len(input.Name) > 50 {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: fmt.Sprintf("must be at most %d character(s)", 50),
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
    // Validate age
    if float64(input.Age) != float64(int64(input.Age)) {
        errs = append(errs, &ValidationError{
            Field:   "age",
            Message: "must be an integer",
        })
    }
    // Validate tags
    if input.Tags == nil {
        errs = append(errs, &ValidationError{
            Field:   "tags",
            Message: "is required",
        })
    }
    if input.Tags != nil && len(input.Tags) < 1 {
        errs = append(errs, &ValidationError{
            Field:   "tags",
            Message: fmt.Sprintf("must have at least %d item(s)", 1),
        })
    }
    if input.Tags != nil && len(input.Tags) > 10 {
        errs = append(errs, &ValidationError{
            Field:   "tags",
            Message: fmt.Sprintf("must have at most %d item(s)", 10),
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

func ValidateGreetingCreateUserOutput(input GreetingCreateUserOutput) error {
    var errs ValidationErrors
    // Validate id
    if input.Id == "" {
        errs = append(errs, &ValidationError{
            Field:   "id",
            Message: "is required",
        })
    }
    // Validate name
    if input.Name == "" {
        errs = append(errs, &ValidationError{
            Field:   "name",
            Message: "is required",
        })
    }
    if len(errs) > 0 {
        return errs
    }
    return nil
}

