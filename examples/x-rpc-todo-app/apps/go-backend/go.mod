module go-backend

go 1.21

require (
	github.com/mattn/go-sqlite3 v1.14.22
	go-backend/generated/server v0.0.0
)

replace go-backend/generated/server => ../../packages/api/generated/go-server/server
