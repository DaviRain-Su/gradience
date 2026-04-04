#!/bin/bash
#
# A2A Test Environment Deployment Script
#
# Usage: ./deploy-test.sh [command]
# Commands:
#   start       - Start the test environment
#   stop        - Stop the test environment
#   restart     - Restart the test environment
#   logs        - Show logs
#   status      - Check status
#   clean       - Clean up volumes and containers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
}

# Start the environment
start() {
    log_info "Starting A2A Test Environment..."

    # Build and start
    docker-compose up -d --build

    log_info "Waiting for services to be ready..."
    sleep 5

    # Check health
    if curl -s http://localhost:3939/health > /dev/null; then
        log_info "AgentM is ready at http://localhost:3939"
    else
        log_warn "AgentM health check failed, checking logs..."
        docker-compose logs --tail=20 agentm
    fi

    log_info "Test environment started successfully!"
    log_info "API: http://localhost:3939"
    log_info "Use 'deploy-test.sh logs' to view logs"
}

# Stop the environment
stop() {
    log_info "Stopping A2A Test Environment..."
    docker-compose down
    log_info "Environment stopped"
}

# Restart the environment
restart() {
    log_info "Restarting A2A Test Environment..."
    stop
    start
}

# Show logs
logs() {
    if [ -z "$2" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$2"
    fi
}

# Check status
status() {
    log_info "Checking service status..."
    docker-compose ps

    echo ""
    log_info "Health checks:"

    # Check AgentM
    if curl -s http://localhost:3939/health > /dev/null; then
        log_info "AgentM: Healthy"
    else
        log_error "AgentM: Unhealthy"
    fi
}

# Clean up
clean() {
    log_warn "This will remove all containers and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        docker system prune -f
        log_info "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Show help
help() {
    cat << EOF
A2A Test Environment Deployment Script

Usage: $0 [command]

Commands:
    start       Start the test environment
    stop        Stop the test environment
    restart     Restart the test environment
    logs        Show logs (optionally: logs [service])
    status      Check service status
    clean       Clean up volumes and containers
    help        Show this help message

Examples:
    $0 start                    # Start all services
    $0 logs                     # Show all logs
    $0 logs agentm              # Show AgentM logs only
    $0 status                   # Check service status
EOF
}

# Main
main() {
    check_docker

    case "${1:-help}" in
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        logs)
            logs "$@"
            ;;
        status)
            status
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            help
            ;;
        *)
            log_error "Unknown command: $1"
            help
            exit 1
            ;;
    esac
}

main "$@"
