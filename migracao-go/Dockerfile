# Binário único (Portal/Identidade + Painel de Locação + Almoxarifado + RH + Compras +
# Financeiro + Programação + Alojamentos) — ver README.md. Os arquivos *_templ.go já são
# gerados e versionados (não precisa de `templ generate` no build), então é um `go build`
# comum. Migrations vão embutidas no binário via go:embed; "static/" não — precisa ir junto
# na imagem final.

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/servidor ./cmd/servidor
RUN CGO_ENABLED=0 go build -o /out/seed ./cmd/seed

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/servidor /out/seed ./
COPY static ./static
# DATABASE_PATH e PASTA_UPLOADS (ver internal/config) apontam pra dentro do volume montado
# no docker-compose.yml — sobrevive a `docker compose up --build`.
RUN mkdir -p /app/data /app/dados
ENV DATABASE_PATH=/app/data/servidor.db
ENV PASTA_UPLOADS=/app/dados
EXPOSE 3010

# cmd/seed roda as migrations (AplicarMigracoes é idempotente) e garante o admin — mesma
# ordem do dia a dia local (scripts/iniciar-projeto.ps1: seed, depois servidor).
CMD ["sh", "-c", "./seed && ./servidor"]
