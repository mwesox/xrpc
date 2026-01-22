package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/example/go-greeting-server/generated/go/server"
)

func greetHandler(ctx context.Context, input interface{}) (interface{}, error) {
	// Type assertion to generated type
	in := input.(server.GreetingGreetInput)
	return server.GreetingGreetOutput{
		Message: fmt.Sprintf("Hello, %s!", in.Name),
	}, nil
}

func main() {
	router := server.NewRouter()
	router.Query("greeting.greet", greetHandler)

	http.Handle("/api", router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server listening on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
