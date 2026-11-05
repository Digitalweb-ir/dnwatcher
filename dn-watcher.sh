#!/usr/bin/env bash
# DigitalNetworkWatcher CLI Installation & Management Script
# Version: 1.0.0
# Description: Easy installation and management of DigitalNetworkWatcher via Docker

# =============================================================================
# CONFIGURATION CONSTANTS - MODIFY THESE VALUES
# =============================================================================
# GitHub repository (format: username/repo-name)
REPO_NAME="Digitalweb-ir/dnwatcher"
# GitHub branch to fetch files from
REPO_BRANCH="main"
# Docker image name (format: username/imagename or just imagename)
DOCKER_IMAGE="erfan1010/dnwatcher"
# Application installation directory
APP_DIR="/opt/dn-watcher"
# Data directory (persistent volumes, database, certificates, etc.)
DATA_DIR="/var/lib/dn-watcher"
# Script installation path (for 'install-script' command)
SCRIPT_INSTALL_PATH="/usr/local/bin/dn-watcher"

# URLs for raw file downloads from GitHub
RAW_BASE_URL="https://raw.githubusercontent.com/${REPO_NAME}/${REPO_BRANCH}"
DOCKER_COMPOSE_URL="${RAW_BASE_URL}/docker-compose.yml"
ENV_EXAMPLE_URL="${RAW_BASE_URL}/.env.example"

# =============================================================================
# COLORS & STYLING
# =============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'
DIM='\033[2m'

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $*"
}

print_header() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║          DigitalNetworkWatcher - Management CLI                  ║"
    echo "║           Xray Config Monitoring & Health Checks                 ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_separator() {
    echo -e "${DIM}────────────────────────────────────────────────────────────────${NC}"
}

# Check if running as root (required for some operations)
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This operation requires root privileges. Please run with sudo."
        return 1
    fi
    return 0
}

# Prompt for yes/no confirmation
confirm() {
    local prompt="$1"
    local default="${2:-n}"
    local response

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    read -rp "$(echo -e "${YELLOW}${prompt}${NC}")" response
    response=${response,,} # to lowercase

    if [[ -z "$response" ]]; then
        response="$default"
    fi

    [[ "$response" == "y" || "$response" == "yes" ]]
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# DEPENDENCY CHECKS & INSTALLATION
# =============================================================================
install_dependencies() {
    log_step "Checking and installing required dependencies..."

    local missing_commands=()

    # Check for required commands
    for cmd in curl wget jq docker docker-compose; do
        if ! command_exists "$cmd"; then
            missing_commands+=("$cmd")
        fi
    done

    if [[ ${#missing_commands[@]} -eq 0 ]]; then
        log_success "All required dependencies are already installed."
        return 0
    fi

    log_warning "Missing commands: ${missing_commands[*]}"

    # Check if Docker/Compose are missing - use official Docker install script
    local docker_missing=false
    local compose_missing=false
    for cmd in "${missing_commands[@]}"; do
        case "$cmd" in
            docker) docker_missing=true ;;
            docker-compose) compose_missing=true ;;
        esac
    done

    # Install Docker using official install script if missing
    if [[ "$docker_missing" == true ]] || [[ "$compose_missing" == true ]]; then
        log_step "Installing Docker using official install script..."
        if ! install_docker; then
            log_error "Failed to install Docker via official script."
            return 1
        fi
        # Re-check after Docker install
        missing_commands=()
        for cmd in curl wget jq docker docker-compose; do
            if ! command_exists "$cmd"; then
                missing_commands+=("$cmd")
            fi
        done
    fi

    # Install remaining dependencies via package manager
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_step "Installing remaining dependencies via package manager..."
        if ! install_via_package_manager "${missing_commands[@]}"; then
            log_error "Failed to install some dependencies."
            return 1
        fi
    fi

    # Start and enable Docker service
    if command_exists systemctl; then
        systemctl enable --now docker 2>/dev/null || true
    fi

    # Add current user to docker group (if not root)
    if [[ $EUID -ne 0 ]] && command_exists usermod; then
        usermod -aG docker "$USER" 2>/dev/null || true
        log_warning "You may need to log out and back in for Docker group changes to take effect."
    fi

    log_success "Dependencies installed successfully."
    return 0
}

# Install Docker using official install script (https://github.com/docker/docker-install)
install_docker() {
    log_info "Downloading and running Docker install script..."

    # Use the official Docker install script
    # This installs Docker Engine, CLI, Compose plugin, and Buildx plugin
    if ! curl -fsSL https://raw.githubusercontent.com/erfanask-dev/docker-script/refs/heads/main/get-docker.sh -o /tmp/docker-install.sh; then
        log_error "Failed to download Docker install script."
        return 1
    fi

    # Run the install script
    if ! sh /tmp/docker-install.sh; then
        log_error "Docker install script failed."
        rm -f /tmp/docker-install.sh
        return 1
    fi

    rm -f /tmp/docker-install.sh

    # Verify Docker installation
    if ! command_exists docker; then
        log_error "Docker installation verification failed."
        return 1
    fi

    configure_arvan_mirror

    # Verify Docker Compose plugin (installed by get.docker.com)
    if ! docker compose version >/dev/null 2>&1; then
        log_warning "Docker Compose plugin not available after Docker install."
        log_info "Attempting to install docker-compose-plugin via package manager..."
        install_docker_compose_plugin
    fi

    log_success "Docker installed successfully."
}

# Configure Docker daemon for Arvan Cloud mirror
configure_arvan_mirror() {
    log_step "Configuring Docker daemon for Arvan Cloud mirror..."

    # Check if the mirror is already configured
    if [[ -f /etc/docker/daemon.json ]]; then
        if grep -q "docker.arvancloud.ir" /etc/docker/daemon.json; then
            log_info "Docker daemon already configured with Arvan Cloud mirror."
            return 0
        fi
    fi

    # Create the daemon.json configuration
    log_info "Setting up Docker daemon configuration..."
    sudo bash -c 'cat > /etc/docker/daemon.json <<EOF
{
  "insecure-registries": ["docker.arvancloud.ir"],
  "registry-mirrors": ["https://docker.arvancloud.ir"]
}
EOF'

    # Reload Docker daemon
    log_info "Restarting Docker daemon..."
    sudo systemctl restart docker

    # Verify Docker is running
    sleep 3
    if docker info --format '{{.Name}}' >/dev/null 2>&1; then
        log_success "Docker configured and restarted successfully with Arvan Cloud mirror."
    else
        log_error "Failed to restart Docker after configuration."
        sudo systemctl status docker --no-pager
        return 1
    fi

    return 0
}

# Install Docker Compose plugin as fallback
install_docker_compose_plugin() {
    if command_exists apt-get; then
        apt-get update -qq && apt-get install -y -qq docker-compose-plugin
    elif command_exists dnf; then
        dnf install -y docker-compose-plugin
    elif command_exists yum; then
        yum install -y docker-compose-plugin
    elif command_exists pacman; then
        pacman -S --noconfirm docker-compose
    elif command_exists apk; then
        apk add --no-cache docker-compose
    else
        return 1
    fi
    return 0
}
install_via_package_manager() {
    local missing_commands=("$@")
    local packages_needed=()

    if command_exists apt-get; then
        log_info "Detected apt package manager (Debian/Ubuntu)..."
        apt-get update -qq
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                docker|docker-compose)
                    # Already handled by install_docker
                    ;;
                *)
                    packages_needed+=("$cmd")
                    ;;
            esac
        done
        if [[ ${#packages_needed[@]} -gt 0 ]]; then
            log_info "Installing packages: ${packages_needed[*]}"
            apt-get install -y -qq "${packages_needed[@]}"
        fi
    elif command_exists dnf; then
        log_info "Detected dnf package manager (Fedora/RHEL)..."
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                docker|docker-compose)
                    ;;
                *)
                    packages_needed+=("$cmd")
                    ;;
            esac
        done
        if [[ ${#packages_needed[@]} -gt 0 ]]; then
            dnf install -y "${packages_needed[@]}"
        fi
    elif command_exists yum; then
        log_info "Detected yum package manager (CentOS/RHEL)..."
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                docker|docker-compose)
                    ;;
                *)
                    packages_needed+=("$cmd")
                    ;;
            esac
        done
        if [[ ${#packages_needed[@]} -gt 0 ]]; then
            yum install -y "${packages_needed[@]}"
        fi
    elif command_exists pacman; then
        log_info "Detected pacman package manager (Arch Linux)..."
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                docker|docker-compose)
                    ;;
                *)
                    packages_needed+=("$cmd")
                    ;;
            esac
        done
        if [[ ${#packages_needed[@]} -gt 0 ]]; then
            pacman -S --noconfirm "${packages_needed[@]}"
        fi
    elif command_exists apk; then
        log_info "Detected apk package manager (Alpine Linux)..."
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                docker|docker-compose)
                    ;;
                *)
                    packages_needed+=("$cmd")
                    ;;
            esac
        done
        if [[ ${#packages_needed[@]} -gt 0 ]]; then
            apk add --no-cache "${packages_needed[@]}"
        fi
    else
        log_error "Unsupported package manager. Please install manually: ${missing_commands[*]}"
        return 1
    fi

    return 0
}

# =============================================================================
# INSTALLATION FUNCTIONS
# =============================================================================
install_app() {
    print_header
    log_step "Starting DigitalNetworkWatcher installation..."

    # Check root for installation
    if ! check_root; then
        return 1
    fi

    # Install dependencies first
    if ! install_dependencies; then
        log_error "Failed to install dependencies."
        return 1
    fi

    # Check if app directory already exists
    if [[ -d "$APP_DIR" ]]; then
        log_warning "Application directory already exists: $APP_DIR"
        if ! confirm "DigitalNetworkWatcher appears to be already installed. Do you want to reinstall?" "n"; then
            log_info "Installation aborted by user."
            return 0
        fi
        log_info "Proceeding with reinstallation..."
    fi

    # Create application directory
    log_step "Creating application directory: $APP_DIR"
    mkdir -p "$APP_DIR"

    # Create data directory
    log_step "Creating data directory: $DATA_DIR"
    mkdir -p "$DATA_DIR"

    # Download docker-compose.yml
    log_step "Downloading docker-compose.yml from GitHub..."
    if ! curl -fsSL "$DOCKER_COMPOSE_URL" -o "$APP_DIR/docker-compose.yml"; then
        log_error "Failed to download docker-compose.yml from $DOCKER_COMPOSE_URL"
        log_error "Please check REPO_NAME and REPO_BRANCH constants in the script."
        return 1
    fi
    log_success "docker-compose.yml downloaded successfully."

    # Prompt for domain before creating .env (needed for Caddyfile)
    if [[ -z "$DOMAIN" ]]; then
        read -rp "$(echo -e "${YELLOW}Enter domain (e.g., watcher.example.com or localhost): ${NC}")" DOMAIN
        if [[ -z "$DOMAIN" ]]; then
            log_error "Domain is required for installation."
            return 1
        fi
    fi

    # Download Caddyfile from GitHub
    log_step "Downloading Caddyfile from GitHub..."
    if ! curl -fsSL "https://raw.githubusercontent.com/Digitalweb-ir/dnwatcher/refs/heads/main/Caddyfile" -o "$APP_DIR/Caddyfile"; then
        log_error "Failed to download Caddyfile from GitHub."
        return 1
    fi
    log_success "Caddyfile downloaded successfully."

    # Generate .env file with the domain
    log_step "Creating .env file with domain..."
    sudo bash -c "cat > "$APP_DIR/.env" << EOF
DOMAIN=$DOMAIN
DOCKER_IMAGE=$DOCKER_IMAGE
ENCRYPTION_KEY=$ENCRYPTION_KEY
ADMIN_PASSWORD=$ADMIN_PASSWORD
SESSION_SECRET=$SESSION_SECRET
FORCE_SECURE_COOKIE=true
EOF
    log_success ".env file created with domain and configuration values."

    # Generate secure passwords if .env contains placeholders
    log_step "Generating secure configuration values..."
    if command_exists openssl; then
        # Generate ENCRYPTION_KEY if not set
        if grep -q "^ENCRYPTION_KEY=$" "$APP_DIR/.env" || grep -q "^ENCRYPTION_KEY=\s*$" "$APP_DIR/.env"; then
            local encryption_key=$(openssl rand -hex 32)
            sed -i "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$encryption_key/" "$APP_DIR/.env"
            log_info "Generated ENCRYPTION_KEY"
        fi

        # Generate SESSION_SECRET if not set
        if grep -q "^SESSION_SECRET=$" "$APP_DIR/.env" || grep -q "^SESSION_SECRET=\s*$" "$APP_DIR/.env"; then
            local session_secret=$(openssl rand -hex 32)
            sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$session_secret/" "$APP_DIR/.env"
            log_info "Generated SESSION_SECRET"
        fi

        # Ask the user for the admin password instead of generating one
        if grep -q "^ADMIN_PASSWORD=$" "$APP_DIR/.env" || grep -q "^ADMIN_PASSWORD=\s*$" "$APP_DIR/.env"; then
            local admin_pass=""
            local admin_pass_confirm=""
            while true; do
                read -rsp "$(echo -e "${YELLOW}Enter admin password (min 8 characters): ${NC}")" admin_pass
                echo
                if [[ ${#admin_pass} -lt 8 ]]; then
                    log_error "Password must be at least 8 characters."
                    continue
                fi
                read -rsp "$(echo -e "${YELLOW}Confirm admin password: ${NC}")" admin_pass_confirm
                echo
                if [[ "$admin_pass" != "$admin_pass_confirm" ]]; then
                    log_error "Passwords do not match. Please try again."
                    continue
                fi
                break
            done
            # Escape sed special characters in the password
            local admin_pass_escaped
            admin_pass_escaped=$(printf '%s' "$admin_pass" | sed -e 's/[\/&]/\\&/g')
            sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$admin_pass_escaped/" "$APP_DIR/.env"
            log_success "Admin password saved to .env"
        fi
    else
        log_warning "openssl not found. Please manually edit .env to set ENCRYPTION_KEY, SESSION_SECRET, and ADMIN_PASSWORD"
    fi

    # Update docker-compose.yml with correct paths
    log_step "Updating docker-compose.yml with correct volume paths..."
    sed -i "s|./data:/data|$DATA_DIR:/data|g" "$APP_DIR/docker-compose.yml"
    sed -i "s|/data/watch.db|$DATA_DIR/watch.db|g" "$APP_DIR/docker-compose.yml"

    # Set proper permissions
    chown -R "$(id -u):$(id -g)" "$APP_DIR" 2>/dev/null || true
    chown -R "$(id -u):$(id -g)" "$DATA_DIR" 2>/dev/null || true

    log_success "Installation completed successfully!"
    print_separator
    log_info "Application directory: $APP_DIR"
    log_info "Data directory: $DATA_DIR"
    log_info "Configuration file: $APP_DIR/.env"
    log_info "Docker Compose file: $APP_DIR/docker-compose.yml"
    print_separator
    log_warning "IMPORTANT: Please edit $APP_DIR/.env to configure your settings before starting!"
    log_warning "At minimum, verify: ENCRYPTION_KEY, SESSION_SECRET, ADMIN_PASSWORD"

    # Ask if user wants to start the application now
    if confirm "Do you want to start DigitalNetworkWatcher now?" "y"; then
        start_app
    fi

    return 0
}

start_app() {
    log_step "Starting DigitalNetworkWatcher..."
    compose_cmd up -d
    log_success "DigitalNetworkWatcher started."
}

stop_app() {
    log_step "Stopping DigitalNetworkWatcher..."
    compose_cmd down
    log_success "DigitalNetworkWatcher stopped."
}

restart_app() {
    log_step "Restarting DigitalNetworkWatcher..."
    stop_app
    sleep 2
    start_app
}

status_app() {
    log_step "Checking DigitalNetworkWatcher status..."
    compose_cmd ps
}

logs_app() {
    local follow="${1:-false}"
    if [[ "$follow" == "true" || "$follow" == "-f" ]]; then
        compose_cmd logs -f
    else
        compose_cmd logs --tail=100
    fi
}

update_app() {
    print_header
    log_step "Updating DigitalNetworkWatcher..."

    if ! check_root; then
        return 1
    fi

    if [[ ! -d "$APP_DIR" ]]; then
        log_error "Application not installed at $APP_DIR"
        return 1
    fi

    # Pull latest image
    log_step "Pulling latest Docker image: $DOCKER_IMAGE"
    docker pull "$DOCKER_IMAGE:latest"

    # Recreate containers with new image
    log_step "Recreating containers with latest image..."
    compose_cmd up -d --pull always

    log_success "Update completed!"
}

# =============================================================================
# EDITING FUNCTIONS
# =============================================================================
edit_env() {
    if [[ ! -f "$APP_DIR/.env" ]]; then
        log_error ".env file not found at $APP_DIR/.env"
        return 1
    fi
    log_info "Opening .env with nano editor..."
    nano "$APP_DIR/.env"
}

edit_compose() {
    if [[ ! -f "$APP_DIR/docker-compose.yml" ]]; then
        log_error "docker-compose.yml not found at $APP_DIR/docker-compose.yml"
        return 1
    fi
    log_info "Opening docker-compose.yml with nano editor..."
    nano "$APP_DIR/docker-compose.yml"
}

# =============================================================================
# UNINSTALL FUNCTION
# =============================================================================
uninstall_app() {
    print_header
    log_warning "This will completely remove DigitalNetworkWatcher!"
    log_warning "The following will be deleted:"
    echo "  - Application directory: $APP_DIR"
    echo "  - Data directory: $DATA_DIR including database!"
    echo "  - Docker containers and images"
    echo "  - Installed CLI script: $SCRIPT_INSTALL_PATH"
    print_separator

    if ! confirm "Are you sure you want to uninstall DigitalNetworkWatcher?" "n"; then
        log_info "Uninstall aborted by user."
        return 0
    fi

    if ! check_root; then
        return 1
    fi

    # Stop and remove containers
    if [[ -f "$APP_DIR/docker-compose.yml" ]]; then
        log_step "Stopping and removing containers..."
        cd "$APP_DIR" && docker compose down -v 2>/dev/null || true
    fi

    # Remove Docker image
    log_step "Removing Docker image..."
    docker rmi "$DOCKER_IMAGE:latest" 2>/dev/null || true

    # Remove application directory
    log_step "Removing application directory: $APP_DIR"
    rm -rf "$APP_DIR"

    # Remove data directory
    log_step "Removing data directory: $DATA_DIR"
    rm -rf "$DATA_DIR"

    # Remove installed script
    if [[ -f "$SCRIPT_INSTALL_PATH" ]]; then
        log_step "Removing CLI script: $SCRIPT_INSTALL_PATH"
        rm -f "$SCRIPT_INSTALL_PATH"
    fi

    log_success "DigitalNetworkWatcher has been completely uninstalled."
}

# =============================================================================
# INSTALL SCRIPT (SELF-INSTALL)
# =============================================================================
install_script() {
    print_header
    log_step "Installing CLI script to $SCRIPT_INSTALL_PATH..."

    if ! check_root; then
        return 1
    fi

    # Download the script from GitHub
    local script_url="${RAW_BASE_URL}/dn-watcher.sh"
    log_info "Downloading script from $script_url..."

    if ! curl -fsSL "$script_url" -o "$SCRIPT_INSTALL_PATH"; then
        log_error "Failed to download script from $script_url"
        log_error "Please check REPO_NAME and REPO_BRANCH constants."
        return 1
    fi

    chmod +x "$SCRIPT_INSTALL_PATH"
    log_success "CLI script installed at $SCRIPT_INSTALL_PATH"
    log_info "You can now run 'dn-watcher' from anywhere."
}

# =============================================================================
# HELP & MENU
# =============================================================================
print_help() {
    print_header
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "  ${CYAN}dn-watcher${NC} <command>"
    echo
    echo -e "${BOLD}COMMANDS:${NC}"
    echo -e "  ${GREEN}install${NC}        - Install DigitalNetworkWatcher (download files, setup dirs, start)"
    echo -e "  ${GREEN}uninstall${NC}      - Completely remove DigitalNetworkWatcher (containers, data, images, script)"
    echo -e "  ${GREEN}install-script${NC} - Install this CLI script to $SCRIPT_INSTALL_PATH"
    echo -e "  ${GREEN}update${NC}         - Pull latest Docker image and restart containers"
    print_separator
    echo -e "  ${GREEN}up${NC}             - Start containers (docker compose up -d)"
    echo -e "  ${GREEN}down${NC}           - Stop containers (docker compose down)"
    echo -e "  ${GREEN}restart${NC}        - Restart containers (down + up)"
    echo -e "  ${GREEN}status${NC}         - Show container status"
    echo -e "  ${GREEN}logs${NC}           - Show container logs (add -f to follow)"
    print_separator
    echo -e "  ${GREEN}edit-env${NC}       - Edit .env configuration file with nano"
    echo -e "  ${GREEN}edit${NC}           - Edit docker-compose.yml with nano"
    echo -e "  ${GREEN}help${NC}           - Show this help message"
    print_separator
    echo -e "${BOLD}CONFIGURATION:${NC}"
    echo -e "  App directory:    $APP_DIR"
    echo -e "  Data directory:   $DATA_DIR"
    echo -e "  Script location:  $SCRIPT_INSTALL_PATH"
    echo -e "  GitHub repo:      $REPO_NAME"
    echo -e "  Docker image:     $DOCKER_IMAGE"
    print_separator
    echo -e "${BOLD}EXAMPLES:${NC}"
    echo -e "  ${DIM}dn-watcher install${NC}         # Full installation"
    echo -e "  ${DIM}dn-watcher up${NC}              # Start the application"
    echo -e "  ${DIM}dn-watcher logs -f${NC}         # Follow logs"
    echo -e "  ${DIM}dn-watcher edit-env${NC}        # Edit configuration"
    echo -e "  ${DIM}dn-watcher update${NC}          # Update to latest version"
    echo -e "  ${DIM}dn-watcher uninstall${NC}       # Complete removal"
    echo
}

show_menu() {
    print_header
    echo -e "${BOLD}MAIN MENU${NC}"
    echo
    echo -e "  ${CYAN}1)${NC}  ${GREEN}Install${NC}          - Full installation (download, setup, start)"
    echo -e "  ${CYAN}2)${NC}  ${GREEN}Uninstall${NC}        - Complete removal"
    echo -e "  ${CYAN}3)${NC}  ${GREEN}Install Script${NC}   - Install CLI to $SCRIPT_INSTALL_PATH"
    echo -e "  ${CYAN}4)${NC}  ${GREEN}Update${NC}           - Pull latest image & restart"
    print_separator
    echo -e "  ${CYAN}5)${NC}  ${BLUE}Up${NC}               - Start containers"
    echo -e "  ${CYAN}6)${NC}  ${BLUE}Down${NC}             - Stop containers"
    echo -e "  ${CYAN}7)${NC}  ${BLUE}Restart${NC}          - Restart containers"
    echo -e "  ${CYAN}8)${NC}  ${BLUE}Status${NC}           - Show container status"
    echo -e "  ${CYAN}9)${NC}  ${BLUE}Logs${NC}             - Show logs (press Ctrl+C to exit)"
    print_separator
    echo -e "  ${CYAN}10)${NC} ${YELLOW}Edit .env${NC}         - Edit configuration file"
    echo -e "  ${CYAN}11)${NC} ${YELLOW}Edit docker-compose${NC} - Edit compose file"
    echo -e "  ${CYAN}12)${NC} ${YELLOW}Help${NC}              - Show help"
    echo -e "  ${CYAN}0)${NC}  ${RED}Exit${NC}"
    print_separator
}

# =============================================================================
# MAIN MENU LOOP
# =============================================================================
main_menu() {
    while true; do
        show_menu
        read -rp "$(echo -e "${BOLD}Select option [0-12]: ${NC}")" choice
        echo

        case "$choice" in
            1) install_app ;;
            2) uninstall_app ;;
            3) install_script ;;
            4) update_app ;;
            5) start_app ;;
            6) stop_app ;;
            7) restart_app ;;
            8) status_app ;;
            9) logs_app true ;;
            10) edit_env ;;
            11) edit_compose ;;
            12) print_help ;;
            0)
                log_info "Goodbye!"
                exit 0
                ;;
            *)
                log_error "Invalid option: $choice"
                ;;
        esac

        echo
        read -rp "$(echo -e "${DIM}Press Enter to continue...${NC}")"
    done
}

# =============================================================================
# COMMAND LINE INTERFACE
# =============================================================================
main() {
    local cmd="${1:-menu}"

    case "$cmd" in
        install)
            install_app
            ;;
        uninstall)
            uninstall_app
            ;;
        install-script)
            install_script
            ;;
        update)
            update_app
            ;;
        up)
            start_app
            ;;
        down)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        status)
            status_app
            ;;
        logs)
            logs_app "$2"
            ;;
        edit-env)
            edit_env
            ;;
        edit)
            edit_compose
            ;;
        help|--help|-h)
            print_help
            ;;
        menu|"")
            main_menu
            ;;
        *)
            log_error "Unknown command: $cmd"
            print_help
            exit 1
            ;;
    esac
}

# =============================================================================
# ENTRY POINT
# =============================================================================
main "$@"