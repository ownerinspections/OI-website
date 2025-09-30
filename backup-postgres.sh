#!/bin/bash

# PostgreSQL Backup Script for Owner Inspections
# Backs up both directus-database and kong-database containers

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/home/mehdi/OI-website/backups"
DATE=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=30

# Database configurations (using functions instead of associative arrays for compatibility)
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

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
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

# Backup a single database
backup_database() {
    local container_name=$1
    local db_user=$2
    local db_password=$3
    local db_name=$4
    
    log "Starting backup for $container_name..."
    
    # Check if container is running
    if ! check_container "$container_name"; then
        return 1
    fi
    
    # Create backup filename
    local backup_file="${BACKUP_DIR}/${container_name}_${DATE}.sql"
    local compressed_file="${backup_file}.gz"
    
    # Perform the backup
    log "Creating backup: $backup_file"
    if docker exec "$container_name" pg_dump -U "$db_user" -h localhost "$db_name" > "$backup_file" 2>/dev/null; then
        success "Database dump created successfully"
        
        # Compress the backup
        log "Compressing backup..."
        if gzip "$backup_file"; then
            success "Backup compressed: $compressed_file"
            
            # Get file size
            local file_size=$(du -h "$compressed_file" | cut -f1)
            log "Backup size: $file_size"
            
            return 0
        else
            error "Failed to compress backup"
            return 1
        fi
    else
        error "Failed to create database dump"
        return 1
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        local deleted_count=$(find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
        if [ "$deleted_count" -gt 0 ]; then
            log "Deleted $deleted_count old backup files"
        else
            log "No old backups to clean up"
        fi
    fi
}

# List recent backups
list_recent_backups() {
    log "Recent backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -lah "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10 || log "No backups found"
    fi
}

# Main backup function
main() {
    log "Starting PostgreSQL backup process..."
    
    # Create backup directory
    create_backup_dir
    
    # Track backup results
    local success_count=0
    local total_count=0
    
    # Backup each database
    local containers=("directus-database" "kong-database")
    for container_name in "${containers[@]}"; do
        total_count=$((total_count + 1))
        
        # Get database configuration
        local db_config=$(get_db_config "$container_name")
        if [ -z "$db_config" ]; then
            error "Unknown container: $container_name"
            continue
        fi
        
        # Parse database configuration (user:password:database)
        IFS=':' read -r db_user db_password db_name <<< "$db_config"
        
        log "Backing up $container_name (User: $db_user, Database: $db_name)"
        
        if backup_database "$container_name" "$db_user" "$db_password" "$db_name"; then
            success_count=$((success_count + 1))
        else
            error "Failed to backup $container_name"
        fi
        
        echo "---"
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Show results
    echo ""
    log "Backup Summary:"
    log "Successful backups: $success_count/$total_count"
    
    if [ $success_count -eq $total_count ]; then
        success "All backups completed successfully!"
    else
        warning "Some backups failed. Check the logs above."
    fi
    
    # List recent backups
    list_recent_backups
}

# Handle script arguments
case "${1:-}" in
    "list")
        list_recent_backups
        ;;
    "cleanup")
        cleanup_old_backups
        ;;
    "help"|"-h"|"--help")
        echo "PostgreSQL Backup Script"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (no args)  - Perform full backup of all databases"
        echo "  list       - List recent backup files"
        echo "  cleanup    - Clean up old backup files"
        echo "  help       - Show this help message"
        echo ""
        echo "Backup files are stored in: $BACKUP_DIR"
        echo "Retention period: $RETENTION_DAYS days"
        ;;
    *)
        main
        ;;
esac
