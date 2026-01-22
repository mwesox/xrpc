package server

import (
	"testing"
)

func TestValidateGreetingGreetInput(t *testing.T) {
	tests := []struct {
		name    string
		input   GreetingGreetInput
		wantErr bool
	}{
		{
			name:    "valid input",
			input:   GreetingGreetInput{Name: "John", Email: "john@example.com"},
			wantErr: false,
		},
		{
			name:    "missing required name",
			input:   GreetingGreetInput{Name: ""},
			wantErr: true,
		},
		{
			name:    "name too short",
			input:   GreetingGreetInput{Name: ""}, // Empty is caught by required
			wantErr: true,
		},
		{
			name:    "name too long",
			input:   GreetingGreetInput{Name: string(make([]byte, 101))}, // 101 characters
			wantErr: true,
		},
		{
			name:    "valid name length",
			input:   GreetingGreetInput{Name: "John"},
			wantErr: false,
		},
		{
			name:    "optional email valid",
			input:   GreetingGreetInput{Name: "John", Email: "test@example.com"},
			wantErr: false,
		},
		{
			name:    "optional email invalid",
			input:   GreetingGreetInput{Name: "John", Email: "invalid-email"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateGreetingGreetInput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateGreetingGreetInput() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil {
				t.Logf("Validation errors: %v", err)
			}
		})
	}
}

func TestValidateGreetingCreateUserInput(t *testing.T) {
	tests := []struct {
		name    string
		input   GreetingCreateUserInput
		wantErr bool
	}{
		{
			name: "valid input",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "john@example.com",
				Age:   25,
				Tags:  []string{"tag1", "tag2"},
			},
			wantErr: false,
		},
		{
			name: "missing name",
			input: GreetingCreateUserInput{
				Name:  "",
				Email: "john@example.com",
				Age:   25,
				Tags:  []string{"tag1"},
			},
			wantErr: true,
		},
		{
			name: "name too short",
			input: GreetingCreateUserInput{
				Name:  "Jo", // Less than 3
				Email: "john@example.com",
				Age:   25,
				Tags:  []string{"tag1"},
			},
			wantErr: true,
		},
		{
			name: "name too long",
			input: GreetingCreateUserInput{
				Name:  string(make([]byte, 51)), // 51 characters
				Email: "john@example.com",
				Age:   25,
				Tags:  []string{"tag1"},
			},
			wantErr: true,
		},
		{
			name: "invalid email",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "not-an-email",
				Age:   25,
				Tags:  []string{"tag1"},
			},
			wantErr: true,
		},
		{
			name: "age not integer",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "john@example.com",
				Age:   25.5, // Not an integer
				Tags:  []string{"tag1"},
			},
			wantErr: true,
		},
		{
			name: "missing tags",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "john@example.com",
				Age:   25,
				Tags:  nil,
			},
			wantErr: true,
		},
		{
			name: "tags too few",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "john@example.com",
				Age:   25,
				Tags:  []string{}, // Empty array
			},
			wantErr: true,
		},
		{
			name: "tags too many",
			input: GreetingCreateUserInput{
				Name:  "John Doe",
				Email: "john@example.com",
				Age:   25,
				Tags:  make([]string, 11), // 11 items
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateGreetingCreateUserInput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateGreetingCreateUserInput() error = %v, wantErr %v", err, tt.wantErr)
				if err != nil {
					if validationErrs, ok := err.(ValidationErrors); ok {
						t.Logf("Validation errors:")
						for _, ve := range validationErrs {
							t.Logf("  - %s: %s", ve.Field, ve.Message)
						}
					} else {
						t.Logf("Error: %v", err)
					}
				}
			}
		})
	}
}

func TestValidationErrors(t *testing.T) {
	errs := ValidationErrors{
		&ValidationError{Field: "name", Message: "is required"},
		&ValidationError{Field: "email", Message: "must be a valid email"},
	}

	errorStr := errs.Error()
	if errorStr == "" {
		t.Error("ValidationErrors.Error() should return non-empty string")
	}
	t.Logf("Combined error message: %s", errorStr)

	// Test individual error
	err := &ValidationError{Field: "test", Message: "test message"}
	if err.Error() == "" {
		t.Error("ValidationError.Error() should return non-empty string")
	}
	t.Logf("Single error message: %s", err.Error())
}
