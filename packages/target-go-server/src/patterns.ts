import { type GeneratedUtility, toPascalCase } from "@xrpckit/sdk";

/**
 * Create a Go enum pattern with type, constants, IsValid, and Parse functions.
 *
 * @param name - The enum type name (PascalCase)
 * @param values - The enum values (strings)
 * @returns Generated utility with enum code
 *
 * @example
 * ```typescript
 * const utility = createGoEnumPattern("Status", ["active", "inactive", "pending"]);
 * // Generates:
 * // type Status string
 * // const (
 * //     StatusActive   Status = "active"
 * //     StatusInactive Status = "inactive"
 * //     StatusPending  Status = "pending"
 * // )
 * // func (s Status) IsValid() bool { ... }
 * // func ParseStatus(s string) (Status, error) { ... }
 * ```
 */
export function createGoEnumPattern(
  name: string,
  values: (string | number)[]
): GeneratedUtility {
  const stringValues = values.filter((v): v is string => typeof v === "string");

  // Generate constant names from values
  const constants = stringValues.map((v) => {
    const constName = `${name}${toPascalCase(v)}`;
    return { constName, value: v };
  });

  const code = `// ${name} enum type
type ${name} string

const (
${constants.map((c) => `\t${c.constName} ${name} = "${c.value}"`).join("\n")}
)

// IsValid checks if the ${name} value is valid
func (e ${name}) IsValid() bool {
\tswitch e {
\tcase ${constants.map((c) => c.constName).join(", ")}:
\t\treturn true
\t}
\treturn false
}

// Parse${name} parses a string into a ${name} value
func Parse${name}(s string) (${name}, error) {
\te := ${name}(s)
\tif !e.IsValid() {
\t\treturn "", fmt.Errorf("invalid ${name}: %s", s)
\t}
\treturn e, nil
}

// All${name}Values returns all valid ${name} values
func All${name}Values() []${name} {
\treturn []${name}{${constants.map((c) => c.constName).join(", ")}}
}`;

  return {
    id: `enum_${name}`,
    code,
    imports: ["fmt"],
    includeOnce: true,
    priority: 100, // Enums should come early
  };
}

/**
 * Create a Go BigInt pattern for handling large integers.
 *
 * @returns Generated utility with BigInt wrapper code
 */
export function createGoBigIntPattern(): GeneratedUtility {
  const code = `// BigInt is a wrapper around big.Int for JSON serialization
type BigInt struct {
\t*big.Int
}

// MarshalJSON implements json.Marshaler for BigInt
func (b BigInt) MarshalJSON() ([]byte, error) {
\tif b.Int == nil {
\t\treturn []byte("null"), nil
\t}
\treturn []byte(b.String()), nil
}

// UnmarshalJSON implements json.Unmarshaler for BigInt
func (b *BigInt) UnmarshalJSON(data []byte) error {
\tstr := string(data)
\tif str == "null" {
\t\tb.Int = nil
\t\treturn nil
\t}
\t// Remove quotes if present
\tif len(str) >= 2 && str[0] == '"' && str[len(str)-1] == '"' {
\t\tstr = str[1 : len(str)-1]
\t}
\tb.Int = new(big.Int)
\t_, ok := b.Int.SetString(str, 10)
\tif !ok {
\t\treturn fmt.Errorf("invalid BigInt: %s", str)
\t}
\treturn nil
}`;

  return {
    id: "bigint",
    code,
    imports: ["math/big", "fmt"],
    includeOnce: true,
    priority: 90,
  };
}

/**
 * Create a Go union wrapper pattern for discriminated unions.
 *
 * @param name - The union type name
 * @param variants - The variant types (Go type names)
 * @returns Generated utility with union wrapper code
 *
 * @example
 * ```typescript
 * const utility = createGoUnionPattern("Result", ["string", "int", "Error"]);
 * // Generates a struct with Value interface{} and type assertion helpers
 * ```
 */
export function createGoUnionPattern(
  name: string,
  variants: string[]
): GeneratedUtility {
  const assertions = variants.map((v) => {
    const methodName = `As${toPascalCase(v.replace(/[*[\]]/g, ""))}`;

    return `// ${methodName} returns the value as ${v}, or ok=false if not that type
func (u ${name}) ${methodName}() (${v}, bool) {
\tval, ok := u.Value.(${v})
\treturn val, ok
}`;
  }).join("\n\n");

  const code = `// ${name} represents a union type that can hold one of several types
type ${name} struct {
\tValue interface{}
}

// MarshalJSON implements json.Marshaler for ${name}
func (u ${name}) MarshalJSON() ([]byte, error) {
\treturn json.Marshal(u.Value)
}

// UnmarshalJSON implements json.Unmarshaler for ${name}
func (u *${name}) UnmarshalJSON(data []byte) error {
\treturn json.Unmarshal(data, &u.Value)
}

${assertions}`;

  return {
    id: `union_${name}`,
    code,
    imports: ["encoding/json"],
    includeOnce: true,
    priority: 80,
  };
}

/**
 * Create a Go tuple struct pattern.
 *
 * @param name - The tuple type name
 * @param elements - The element types (Go type names)
 * @returns Generated utility with tuple struct code
 *
 * @example
 * ```typescript
 * const utility = createGoTuplePattern("Coordinate", ["float64", "float64"]);
 * // Generates:
 * // type Coordinate struct {
 * //     V0 float64 `json:"0"`
 * //     V1 float64 `json:"1"`
 * // }
 * ```
 */
export function createGoTuplePattern(
  name: string,
  elements: string[]
): GeneratedUtility {
  const fields = elements.map((el, i) => `\tV${i} ${el} \`json:"${i}"\``);

  const code = `// ${name} represents a tuple type with ${elements.length} elements
type ${name} struct {
${fields.join("\n")}
}

// MarshalJSON implements json.Marshaler for ${name} to serialize as JSON array
func (t ${name}) MarshalJSON() ([]byte, error) {
\treturn json.Marshal([]interface{}{${elements.map((_, i) => `t.V${i}`).join(", ")}})
}

// UnmarshalJSON implements json.Unmarshaler for ${name} from JSON array
func (t *${name}) UnmarshalJSON(data []byte) error {
\tvar arr []json.RawMessage
\tif err := json.Unmarshal(data, &arr); err != nil {
\t\treturn err
\t}
\tif len(arr) != ${elements.length} {
\t\treturn fmt.Errorf("expected ${elements.length} elements, got %d", len(arr))
\t}
${elements.map((_, i) => `\tif err := json.Unmarshal(arr[${i}], &t.V${i}); err != nil {\n\t\treturn fmt.Errorf("element ${i}: %w", err)\n\t}`).join("\n")}
\treturn nil
}`;

  return {
    id: `tuple_${name}`,
    code,
    imports: ["encoding/json", "fmt"],
    includeOnce: true,
    priority: 70,
  };
}

/**
 * Create a Go date/time utility pattern.
 *
 * @returns Generated utility with date helpers
 */
export function createGoDatePattern(): GeneratedUtility {
  const code = `// DateTime is a wrapper around time.Time with flexible JSON parsing
type DateTime struct {
\ttime.Time
}

// Common date/time formats to try when parsing
var dateTimeFormats = []string{
\ttime.RFC3339,
\ttime.RFC3339Nano,
\t"2006-01-02T15:04:05Z07:00",
\t"2006-01-02T15:04:05",
\t"2006-01-02",
}

// UnmarshalJSON implements json.Unmarshaler for DateTime
func (d *DateTime) UnmarshalJSON(data []byte) error {
\tstr := string(data)
\tif str == "null" {
\t\treturn nil
\t}
\t// Remove quotes
\tif len(str) >= 2 && str[0] == '"' && str[len(str)-1] == '"' {
\t\tstr = str[1 : len(str)-1]
\t}
\t// Try each format
\tfor _, format := range dateTimeFormats {
\t\tif t, err := time.Parse(format, str); err == nil {
\t\t\td.Time = t
\t\t\treturn nil
\t\t}
\t}
\treturn fmt.Errorf("cannot parse date: %s", str)
}

// MarshalJSON implements json.Marshaler for DateTime
func (d DateTime) MarshalJSON() ([]byte, error) {
\treturn json.Marshal(d.Time.Format(time.RFC3339))
}`;

  return {
    id: "datetime",
    code,
    imports: ["time", "encoding/json", "fmt"],
    includeOnce: true,
    priority: 85,
  };
}
