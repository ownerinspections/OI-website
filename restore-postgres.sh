#!/bin/bash

# PostgreSQL Restore Script for Owner Inspections
# Restores both directus-database and kong-database containers

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/Users/mehdi/ownerinspection/ownerinspections.com.au/backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Get database configuration
get_db_config() {
    local container_name=$1
    case "$container_name" in
        "directus-database")
            echo "directus:directus:directus"
            ;;
        "kong-database")
            echo "kong:kong:kong"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Check if container is running
check_container() {
    local container_name=$1
    if ! docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        error "Container $container_name is not running!"
        return 1
    fi
    return 0
}

# List available backups
list_backups() {
    local container_name=$1
    log "Available backups for $container_name:"
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -lah "$BACKUP_DIR"/${container_name}_*.sql.gz 2>/dev/null | tail -10 || log "No backups found for $container_name"
    else
        log "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Restore a database
restore_database() {
    local container_name=$1
    local backup_file=$2
    local db_user=$3
    local db_password=$4
    local db_name=$5
    
    log "Starting restore for $container_name from $backup_file..."
    
    # Check if container is running
    if ! check_container "$container_name"; then
        return 1
    fi
    
    # Check if backup file exists
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if backup file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing backup file..."
        local temp_file="/tmp/restore_$(basename "$backup_file" .gz)"
        if ! gunzip -c "$backup_file" > "$temp_file"; then
            error "Failed to decompress backup file"
            return 1
        fi
        backup_file="$temp_file"
    fi
    
    # Confirm restore operation
    warning "This will REPLACE all data in $container_name database!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled by user"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        return 0
    fi
    
    # Drop and recreate database
    log "Dropping and recreating database..."
    if ! docker exec "$container_name" psql -U "$db_user" -h localhost -c "DROP DATABASE IF EXISTS $db_name;" 2>/dev/null; then
        warning "Could not drop database (might not exist)"
    fi
    
    if ! docker exec "$container_name" psql -U "$db_user" -h localhost -c "CREATE DATABASE $db_name;" 2>/dev/null; then
        error "Failed to create database"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        return 1
    fi
    
    # Restore the database
    log "Restoring database from backup..."
    if docker exec -i "$container_name" psql -U "$db_user" -h localhost "$db_name" < "$backup_file" 2>/dev/null; then
        success "Database restored successfully"
        
        # Clean up temp file if it exists
        [ -f "$temp_file" ] && rm -f "$temp_file"
        
        return 0
    else
        error "Failed to restore database"
        [ -f "$temp_file" ] && rm -f "$temp_file"
        return 1
    fi
}

# Interactive restore
interactive_restore() {
    local container_name=$1
    
    # Get database configuration
    local db_config=$(get_db_config "$container_name")
    if [ -z "$db_config" ]; then
        error "Unknown container: $container_name"
        return 1
    fi
    
    # Parse database configuration (user:password:database)
    IFS=':' read -r db_user db_password db_name <<< "$db_config"
    
    # List available backups
    list_backups "$container_name"
    
    # Get backup file from user
    echo ""
    read -p "Enter the backup filename (or full path): " backup_file
    
    # Handle relative paths
    if [[ "$backup_file" != /* ]]; then
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    # Restore the database
    restore_database "$container_name" "$backup_file" "$db_user" "$db_password" "$db_name"
}

# Show help
show_help() {
    echo "PostgreSQL Restore Script"
    echo ""
    echo "Usage: $0 [command] [container] [backup_file]"
    echo ""
    echo "Commands:"
    echo "  interactive [container]  - Interactive restore for a specific container"
    echo "  restore [container] [file] - Restore specific backup file"
    echo "  list [container]         - List available backups for container"
    echo "  help                    - Show this help message"
    echo ""
    echo "Containers:"
    echo "  directus-database       - Directus CMS database"
    echo "  kong-database          - Kong API Gateway database"
    echo ""
    echo "Examples:"
    echo "  $0 interactive directus-database"
    echo "  $0 restore kong-database kong-database_20250930_150227.sql.gz"
    echo "  $0 list directus-database"
    echo ""
    echo "Backup files are stored in: $BACKUP_DIR"
}

# Main function
main() {
    case "${1:-}" in
        "interactive")
            if [ -z "${2:-}" ]; then
                error "Container name required for interactive restore"
                show_help
                exit 1
            fi
            interactive_restore "$2"
            ;;
        "restore")
            if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
                error "Container name and backup file required for restore"
                show_help
                exit 1
            fi
            
            # Get database configuration
            local db_config=$(get_db_config "$2")
            if [ -z "$db_config" ]; then
                error "Unknown container: $2"
                exit 1
            fi
            
            # Parse database configuration (user:password:database)
            IFS=':' read -r db_user db_password db_name <<< "$db_config"
            
            # Handle relative paths
            local backup_file="$3"
            if [[ "$backup_file" != /* ]]; then
                backup_file="$BACKUP_DIR/$backup_file"
            fi
            
            restore_database "$2" "$backup_file" "$db_user" "$db_password" "$db_name"
            ;;
        "list")
            if [ -z "${2:-}" ]; then
                error "Container name required for list command"
                show_help
                exit 1
            fi
            list_backups "$2"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Invalid command: ${1:-}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
