package server

import (
    "fmt"
    "strings"
    "regexp"
    "net/mail"
    "net/url"
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

