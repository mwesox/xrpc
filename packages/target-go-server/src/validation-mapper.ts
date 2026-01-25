import {
  type ValidationMapping,
  type ValidationResult,
  type ValidationContext,
  ValidationMapperBase,
} from "@xrpckit/sdk";

/**
 * Represents a Go validation check with its code and required imports.
 */
export interface GoValidationCode {
  /** The Go condition expression (e.g., "len(field) < 5") */
  condition: string;
  /** The error message to display if validation fails */
  message: string;
  /** Required Go imports for this validation */
  imports?: string[];
  /** Whether this validation should be wrapped in a non-empty check for optional fields */
  skipIfEmpty?: boolean;
}

/**
 * Go validation mapper that converts xRPC validation rules to Go validation code.
 * Extends ValidationMapperBase to ensure all validation kinds are handled.
 */
export class GoValidationMapper extends ValidationMapperBase<GoValidationCode> {
  /**
   * Complete mapping of all validation kinds to Go validation code.
   * TypeScript enforces exhaustiveness at compile time.
   */
  readonly validationMapping: ValidationMapping<GoValidationCode> = {
    // String validations
    minLength: (ctx) => this.handleMinLength(ctx),
    maxLength: (ctx) => this.handleMaxLength(ctx),
    email: (ctx) => this.handleEmail(ctx),
    url: (ctx) => this.handleUrl(ctx),
    uuid: (ctx) => this.handleUuid(ctx),
    regex: (ctx) => this.handleRegex(ctx),

    // Number validations
    min: (ctx) => this.handleMin(ctx),
    max: (ctx) => this.handleMax(ctx),
    int: (ctx) => this.handleInt(ctx),
    positive: (ctx) => this.handlePositive(ctx),
    negative: (ctx) => this.handleNegative(ctx),

    // Array validations
    minItems: (ctx) => this.handleMinItems(ctx),
    maxItems: (ctx) => this.handleMaxItems(ctx),
  };

  // --- String validation handlers ---

  private handleMinLength(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value, isRequired } = ctx;
    // For required fields, skip check if empty (already caught by required check)
    const condition = isRequired
      ? `${fieldPath} != "" && len(${fieldPath}) < ${value}`
      : `len(${fieldPath}) < ${value}`;

    return {
      validation: {
        condition,
        message: `fmt.Sprintf("must be at least %d character(s)", ${value})`,
        skipIfEmpty: !isRequired,
      },
      imports: ["fmt"],
    };
  }

  private handleMaxLength(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value } = ctx;
    return {
      validation: {
        condition: `len(${fieldPath}) > ${value}`,
        message: `fmt.Sprintf("must be at most %d character(s)", ${value})`,
      },
      imports: ["fmt"],
    };
  }

  private handleEmail(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, isRequired } = ctx;
    // Use mail.ParseAddress for email validation
    const condition = `func() bool { _, err := mail.ParseAddress(${fieldPath}); return err != nil }()`;

    return {
      validation: {
        condition,
        message: `"must be a valid email address"`,
        skipIfEmpty: !isRequired,
      },
      imports: ["net/mail"],
    };
  }

  private handleUrl(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, isRequired } = ctx;
    // Use url.Parse with scheme/host validation
    const condition = `func() bool { u, err := url.Parse(${fieldPath}); return err != nil || u.Scheme == "" || u.Host == "" }()`;

    return {
      validation: {
        condition,
        message: `"must be a valid URL"`,
        skipIfEmpty: !isRequired,
      },
      imports: ["net/url"],
    };
  }

  private handleUuid(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, isRequired } = ctx;
    const uuidRegex = `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`;
    const condition = `func() bool { matched, _ := regexp.MatchString("${uuidRegex}", ${fieldPath}); return !matched }()`;

    return {
      validation: {
        condition,
        message: `"must be a valid UUID"`,
        skipIfEmpty: !isRequired,
      },
      imports: ["regexp"],
    };
  }

  private handleRegex(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value, isRequired, allRules } = ctx;

    // Skip if email/url/uuid is set (they have dedicated validators)
    if (allRules.email || allRules.url || allRules.uuid) {
      return {
        validation: {
          condition: "false", // Never triggers
          message: `""`, // No message
        },
      };
    }

    // Escape the regex pattern for Go
    const escapedRegex = String(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    const condition = `func() bool { matched, _ := regexp.MatchString("${escapedRegex}", ${fieldPath}); return !matched }()`;

    return {
      validation: {
        condition,
        message: `"must match the required pattern"`,
        skipIfEmpty: !isRequired,
      },
      imports: ["regexp"],
    };
  }

  // --- Number validation handlers ---

  private handleMin(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value } = ctx;
    return {
      validation: {
        condition: `${fieldPath} < ${value}`,
        message: `fmt.Sprintf("must be at least %v", ${value})`,
      },
      imports: ["fmt"],
    };
  }

  private handleMax(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value } = ctx;
    return {
      validation: {
        condition: `${fieldPath} > ${value}`,
        message: `fmt.Sprintf("must be at most %v", ${value})`,
      },
      imports: ["fmt"],
    };
  }

  private handleInt(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath } = ctx;
    return {
      validation: {
        condition: `float64(${fieldPath}) != float64(int64(${fieldPath}))`,
        message: `"must be an integer"`,
      },
    };
  }

  private handlePositive(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath } = ctx;
    return {
      validation: {
        condition: `${fieldPath} <= 0`,
        message: `"must be positive"`,
      },
    };
  }

  private handleNegative(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath } = ctx;
    return {
      validation: {
        condition: `${fieldPath} >= 0`,
        message: `"must be negative"`,
      },
    };
  }

  // --- Array validation handlers ---

  private handleMinItems(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value } = ctx;
    return {
      validation: {
        condition: `${fieldPath} != nil && len(${fieldPath}) < ${value}`,
        message: `fmt.Sprintf("must have at least %d item(s)", ${value})`,
      },
      imports: ["fmt"],
    };
  }

  private handleMaxItems(ctx: ValidationContext): ValidationResult<GoValidationCode> {
    const { fieldPath, value } = ctx;
    return {
      validation: {
        condition: `${fieldPath} != nil && len(${fieldPath}) > ${value}`,
        message: `fmt.Sprintf("must have at most %d item(s)", ${value})`,
      },
      imports: ["fmt"],
    };
  }
}
