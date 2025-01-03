# Candler

This project is a data service for Binance Futures, built with TypeScript, JavaScript, and Vue. It uses TimescaleDB for
data storage and provides various functionalities for fetching, storing, and computing indicators for candlestick data.

## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [License](#license)

## Project Structure

- `backend/`: Contains the backend service code.
- `frontend/`: Contains the frontend application code.
- `docker-compose.yml`: Docker Compose configuration for setting up the development environment.

## Prerequisites

- Docker
- Docker Compose

## Installation

1. Clone the repository:

```sh
git clone https://github.com/logical-luke/candler.git

cd candler
```

2. Start the services using Docker Compose:

```sh
docker-compose up -d
```

## Usage
Access the frontend application at http://localhost:5173.

 
## License
This project is licensed under the MIT License. See the LICENSE file for details.