#!/bin/bash
# Task Management CLI for Obsidian
# Usage: ./scripts/task.sh [list|update|create|show|open] [args...]

set -e

# Configuration
VAULT_PATH="${VAULT_PATH:-$(cd "$(dirname "$0")/.." && pwd)/docs/tasks}"
TEMPLATE_PATH="$(cd "$(dirname "$0")/.." && pwd)/docs/templates/task-template.md"
OBSIDIAN_BIN="${OBSIDIAN_BIN:-/Applications/Obsidian.app/Contents/MacOS/obsidian}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure vault path exists
mkdir -p "$VAULT_PATH"

# Get the next task ID
function get_next_id() {
    local max_id=0
    for file in "$VAULT_PATH"/GRA-*.md; do
        if [ -f "$file" ]; then
            local id=$(basename "$file" .md | sed 's/GRA-//')
            if [[ "$id" =~ ^[0-9]+$ ]]; then
                if [ "$id" -gt "$max_id" ]; then
                    max_id=$id
                fi
            fi
        fi
    done
    echo "GRA-$((max_id + 1))"
}

# List tasks
function list_tasks() {
    local filter_status=${1:-all}
    local filter_priority=${2:-all}
    local filter_project=${3:-all}
    
    echo -e "${BLUE}Tasks in $VAULT_PATH:${NC}"
    echo ""
    
    local count=0
    for file in "$VAULT_PATH"/*.md; do
        if [ ! -f "$file" ]; then
            echo -e "${YELLOW}No tasks found.${NC}"
            return
        fi
        
        # Parse frontmatter
        local id=$(grep "^linear-id:" "$file" 2>/dev/null | cut -d: -f2- | tr -d ' ' || echo "")
        local title=$(grep "^title:" "$file" 2>/dev/null | cut -d: -f2- | sed 's/^ *"//; s/"$//' || echo "")
        local status=$(grep "^status:" "$file" 2>/dev/null | cut -d: -f2- | tr -d ' ' || echo "todo")
        local priority=$(grep "^priority:" "$file" 2>/dev/null | cut -d: -f2- | tr -d ' ' || echo "P3")
        local project=$(grep "^project:" "$file" 2>/dev/null | cut -d: -f2- | sed 's/^ *"//; s/"$//' || echo "")
        
        # Apply filters
        if [ "$filter_status" != "all" ] && [ "$status" != "$filter_status" ]; then
            continue
        fi
        if [ "$filter_priority" != "all" ] && [ "$priority" != "$filter_priority" ]; then
            continue
        fi
        if [ "$filter_project" != "all" ] && [[ ! "$project" =~ $filter_project ]]; then
            continue
        fi
        
        # Color coding
        local status_color=$NC
        case "$status" in
            "done") status_color=$GREEN ;;
            "in-progress") status_color=$YELLOW ;;
            "todo") status_color=$NC ;;
        esac
        
        local priority_color=$NC
        case "$priority" in
            "P0") priority_color=$RED ;;
            "P1") priority_color=$YELLOW ;;
            "P2") priority_color=$BLUE ;;
        esac
        
        printf "${priority_color}[%-2s]${NC} ${status_color}%-12s${NC} %-10s %s\n" \
            "$priority" "[$status]" "$id" "$title"
        ((count++))
    done
    
    echo ""
    echo -e "${BLUE}Total: $count tasks${NC}"
}

# Show task details
function show_task() {
    local task_id=$1
    local file="$VAULT_PATH/$task_id.md"
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Task not found: $task_id${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Task Details:${NC}"
    echo "=============="
    cat "$file"
}

# Update task status
function update_status() {
    local task_id=$1
    local new_status=$2
    local file="$VAULT_PATH/$task_id.md"
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Task not found: $task_id${NC}"
        exit 1
    fi
    
    # Get current status
    local old_status=$(grep "^status:" "$file" | cut -d: -f2- | tr -d ' ')
    
    # Update status
    sed -i.bak "s/^status: .*/status: $new_status/" "$file" && rm -f "$file.bak"
    
    # Add log entry
    local timestamp=$(date +"%Y-%m-%d %H:%M")
    echo -e "\n- $timestamp: Status changed from \"$old_status\" to \"$new_status\"" >> "$file"
    
    echo -e "${GREEN}✅ Updated $task_id: $old_status → $new_status${NC}"
    
    # Open in Obsidian if requested
    if [ "$3" == "--open" ]; then
        open_task "$task_id"
    fi
}

# Create new task
function create_task() {
    local title="${1:-New Task}"
    local priority="${2:-P2}"
    local project="${3:-General}"
    local task_id=$(get_next_id)
    local file="$VAULT_PATH/$task_id.md"
    local timestamp=$(date +"%Y-%m-%d")
    
    # Create from template or default
    if [ -f "$TEMPLATE_PATH" ]; then
        cp "$TEMPLATE_PATH" "$file"
        # Replace placeholders
        sed -i.bak "s/{{ID}}/$task_id/g" "$file"
        sed -i.bak "s/{{TITLE}}/$title/g" "$file"
        sed -i.bak "s/{{PRIORITY}}/$priority/g" "$file"
        sed -i.bak "s/{{PROJECT}}/$project/g" "$file"
        sed -i.bak "s/{{DATE}}/$timestamp/g" "$file"
        rm -f "$file.bak"
    else
        # Create default template
        cat > "$file" << EOF
---
linear-id: $task_id
title: "$title"
status: todo
priority: $priority
project: "$project"
created: $timestamp
assignee: "Code Agent"
tags: [task, ${priority,,}, ${project,,}]
---

# $task_id: $title

## Description

## Acceptance Criteria
- [ ] 

## Related

## Notes

## Log
- $timestamp: Created
EOF
    fi
    
    echo -e "${GREEN}✅ Created $task_id: $title${NC}"
    
    # Open in Obsidian if available
    if [ -f "$OBSIDIAN_BIN" ]; then
        open_task "$task_id"
    fi
}

# Open task in Obsidian
function open_task() {
    local task_id=$1
    local file="$VAULT_PATH/$task_id.md"
    
    if [ -f "$OBSIDIAN_BIN" ]; then
        echo -e "${BLUE}📝 Opening in Obsidian...${NC}"
        "$OBSIDIAN_BIN" "$file" &
    else
        echo -e "${YELLOW}⚠️  Obsidian not found. Opening with default editor...${NC}"
        open "$file" || xdg-open "$file" || nano "$file"
    fi
}

# Open vault in Obsidian
function open_vault() {
    if [ -f "$OBSIDIAN_BIN" ]; then
        echo -e "${BLUE}📝 Opening Obsidian vault...${NC}"
        "$OBSIDIAN_BIN" "$(dirname "$VAULT_PATH")" &
    else
        echo -e "${RED}❌ Obsidian not found at $OBSIDIAN_BIN${NC}"
        echo "Set OBSIDIAN_BIN environment variable or install Obsidian."
        exit 1
    fi
}

# Show statistics
function show_stats() {
    echo -e "${BLUE}Task Statistics:${NC}"
    echo "================"
    
    local total=$(ls -1 "$VAULT_PATH"/*.md 2>/dev/null | wc -l)
    local todo=$(grep -l "^status: todo" "$VAULT_PATH"/*.md 2>/dev/null | wc -l)
    local in_progress=$(grep -l "^status: in-progress" "$VAULT_PATH"/*.md 2>/dev/null | wc -l)
    local done=$(grep -l "^status: done" "$VAULT_PATH"/*.md 2>/dev/null | wc -l)
    
    echo "Total tasks:   $total"
    echo -e "${NC}  Todo:        $todo"
    echo -e "${YELLOW}  In Progress: $in_progress"
    echo -e "${GREEN}  Done:        $done"
    
    echo ""
    echo -e "${BLUE}By Priority:${NC}"
    for p in P0 P1 P2 P3; do
        local count=$(grep -l "^priority: $p" "$VAULT_PATH"/*.md 2>/dev/null | wc -l)
        echo "  $p: $count"
    done
}

# Search tasks
function search_tasks() {
    local query=$1
    echo -e "${BLUE}Searching for: $query${NC}"
    echo ""
    
    grep -r "$query" "$VAULT_PATH" --include="*.md" -l | while read file; do
        local id=$(basename "$file" .md)
        local title=$(grep "^title:" "$file" | cut -d: -f2- | sed 's/^ *"//; s/"$//')
        echo "  $id: $title"
    done
}

# Main command dispatcher
case "${1:-help}" in
    list|ls)
        list_tasks "${2:-all}" "${3:-all}" "${4:-all}"
        ;;
    show|view|cat)
        if [ -z "$2" ]; then
            echo -e "${RED}❌ Usage: $0 show <task-id>${NC}"
            exit 1
        fi
        show_task "$2"
        ;;
    update|status)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}❌ Usage: $0 update <task-id> <status> [--open]${NC}"
            echo "Status: todo, in-progress, done"
            exit 1
        fi
        update_status "$2" "$3" "$4"
        ;;
    create|new|add)
        create_task "${2:-New Task}" "${3:-P2}" "${4:-General}"
        ;;
    open|edit)
        if [ -z "$2" ]; then
            open_vault
        else
            open_task "$2"
        fi
        ;;
    stats|stat)
        show_stats
        ;;
    search|find|grep)
        if [ -z "$2" ]; then
            echo -e "${RED}❌ Usage: $0 search <query>${NC}"
            exit 1
        fi
        search_tasks "$2"
        ;;
    help|--help|-h)
        echo "Task Management CLI for Obsidian"
        echo ""
        echo "Usage: $0 <command> [args...]"
        echo ""
        echo "Commands:"
        echo "  list [status] [priority] [project]  List tasks (filters optional)"
        echo "  show <task-id>                      Show task details"
        echo "  create <title> [priority] [project] Create new task"
        echo "  update <task-id> <status> [--open]  Update task status"
        echo "  open [task-id]                      Open task/vault in Obsidian"
        echo "  stats                               Show statistics"
        echo "  search <query>                      Search tasks"
        echo "  help                                Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 list                           # List all tasks"
        echo "  $0 list todo P0                   # List P0 todo tasks"
        echo "  $0 create \"Fix bug\" P0 \"AgentM\"  # Create P0 task"
        echo "  $0 update GRA-1 done              # Mark as done"
        echo "  $0 search indexer                 # Search for 'indexer'"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo "Run '$0 help' for usage."
        exit 1
        ;;
esac
