.PHONY: start stop logs shell npm-backend npm-frontend

start:
	docker-compose up -d

restart:
	docker-compose restart


stop:
	docker-compose down

logs:
	docker-compose logs -f

shell-backend:
	docker-compose exec backend sh

shell-frontend:
	docker-compose exec frontend sh

npm-backend:
	docker-compose exec backend npm $(cmd)

npm-frontend:
	docker-compose exec frontend npm $(cmd)

init-db:
	docker-compose exec backend npx ts-node src/commands/initDb.ts