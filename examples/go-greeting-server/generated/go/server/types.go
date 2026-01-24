package server

type GreetingGreetInput struct {
    Name string `json:"name"`
}

type GreetingGreetOutput struct {
    Message string `json:"message"`
}
