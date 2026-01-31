# TrueTrace Vault

A secure, end-to-end encrypted vault application with passkey authentication, real-time synchronization, and property sharing capabilities. Built with Next.js, Socket.IO, and libsodium for maximum security and privacy.

## 🚀 Try It Out

**Live Demo**: [https://truetrace-production.up.railway.app/](https://truetrace-production.up.railway.app/)

Experience TrueTrace in your browser - no installation required! Use your device's passkey (Touch ID, Face ID, Windows Hello, etc.) to get started.

## Features

- 🔐 **Passkey Authentication** - Secure, passwordless authentication using WebAuthn
- 🔒 **End-to-End Encryption** - All data encrypted client-side with libsodium (XSalsa20-Poly1305)
- 📱 **Multi-Device Support** - Link multiple devices to the same vault
- ⚡ **Real-Time Sync** - Instant synchronization across all devices via Socket.IO
- 🔗 **Property Sharing** - Share specific properties with other entities securely
- 📊 **Event-Sourced Architecture** - Immutable event log for auditability and consistency
- 🎨 **Modern UI** - Clean, responsive interface with dark theme

## Architecture Overview

```mermaid
graph TB
    subgraph "Client (Browser)"
        UI[React UI]
        Vault[useVault Hook]
        Stream[useEventStream Hook]
        Crypto[Crypto Module]
        Socket[Socket.IO Client]
    end
    
    subgraph "Server"
        NextJS[Next.js API Routes]
        SocketIO[Socket.IO Server]
        Storage[File Storage]
        Session[Session Management]
    end
    
    subgraph "Storage Layer"
        Events[Event Logs<br/>entities/*/events.json]
        Shares[Share Records<br/>entities/*/shares.json]
        Passkeys[Passkey Mapping<br/>entities/_passkeys.json]
    end
    
    UI --> Vault
    Vault --> Stream
    Vault --> Crypto
    Stream --> Socket
    Socket <--> SocketIO
    Vault --> NextJS
    NextJS --> Storage
    NextJS --> Session
    Storage --> Events
    Storage --> Shares
    Storage --> Passkeys
    SocketIO --> Storage
```

## System Components

### Client-Side

- **React UI Components** - User interface built with React 19
- **useVault Hook** - Main state management and business logic
- **useEventStream Hook** - Real-time event synchronization
- **Crypto Module** - Encryption/decryption using libsodium
- **Socket.IO Client** - WebSocket connection for real-time updates

### Server-Side

- **Next.js API Routes** - REST endpoints for authentication, entities, shares
- **Socket.IO Server** - WebSocket server for event broadcasting
- **File Storage** - JSON-based file storage for events and metadata
- **Session Management** - Iron-session for secure session handling

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API
    participant Storage
    
    User->>Browser: Click "Log In"
    Browser->>Browser: Check for existing passkey
    alt New User
        Browser->>Browser: Generate passkey via WebAuthn
        Browser->>API: POST /api/entities/init (createIfMissing: true)
        API->>Storage: Create new entity
        Storage-->>API: Entity ID
        API-->>Browser: { entityId, created: true }
    else Existing User
        Browser->>Browser: Authenticate with passkey
        Browser->>API: POST /api/session
        API->>Storage: Lookup entity by passkey
        Storage-->>API: Entity ID
        API-->>Browser: Session created
    end
    Browser->>Browser: Load entity key from IndexedDB
    Browser->>Browser: Connect to Socket.IO
    Browser->>Browser: Subscribe to entity events
```

## Device Linking Flow

```mermaid
sequenceDiagram
    participant DeviceA
    participant DeviceB
    participant API
    participant Storage
    
    Note over DeviceA: Device A (has key)
    DeviceA->>DeviceA: Generate invite code
    DeviceA->>DeviceA: Seal private key with invite code
    DeviceA->>API: POST /api/invites/create
    API->>Storage: Store invite record
    API-->>DeviceA: { expiresAt }
    
    Note over DeviceB: Device B (new device)
    DeviceB->>DeviceB: Authenticate with passkey
    DeviceB->>DeviceB: Enter invite code
    DeviceB->>API: POST /api/invites/consume
    API->>Storage: Retrieve invite record
    Storage-->>API: Sealed private key
    API-->>DeviceB: { entityId, sealed }
    DeviceB->>DeviceB: Open sealed key with invite code
    DeviceB->>DeviceB: Store key in IndexedDB
    DeviceB->>API: POST /api/entities/link
    API->>Storage: Link passkey to entity
    DeviceB->>DeviceB: Connect to Socket.IO
    DeviceB->>DeviceB: Receive event replay
```

## Property Sharing Flow

```mermaid
sequenceDiagram
    participant EntityA
    participant EntityB
    participant API
    participant SocketIO
    participant Storage
    
    Note over EntityA: Source Entity
    EntityA->>EntityA: Select property to share
    EntityA->>EntityA: Generate share code
    EntityA->>EntityA: Seal entity key with share code
    EntityA->>API: POST /api/shares/create
    API->>Storage: Store share record
    API-->>EntityA: { expiresAt }
    
    Note over EntityB: Target Entity
    EntityB->>EntityB: Enter share code
    EntityB->>API: POST /api/shares/consume
    API->>Storage: Retrieve share record
    API->>Storage: Register outgoing share (EntityA)
    API->>Storage: Register incoming share (EntityB)
    API->>Storage: Get source entity events
    Storage-->>API: Recent events
    API->>SocketIO: Emit sharedEvent to EntityB
    SocketIO-->>EntityB: Recent events (encrypted)
    API-->>EntityB: { sourceEntityId, propertyName, sealedKey }
    EntityB->>EntityB: Open sealed key with share code
    EntityB->>EntityB: Queue events (if key not ready)
    EntityB->>EntityB: Decrypt events
    EntityB->>EntityB: Update sharedData state
    
    Note over EntityA: Property Update
    EntityA->>EntityA: Update property value
    EntityA->>SocketIO: Emit event with propertyHint
    SocketIO->>Storage: Append event
    SocketIO->>SocketIO: Check outgoing shares
    SocketIO->>EntityB: Emit sharedEvent
    EntityB->>EntityB: Decrypt and update
```

## Encryption Architecture

```mermaid
graph LR
    subgraph "Entity Key Generation"
        Random[Random Bytes]
        KeyPair[Entity Key Pair<br/>Public/Private]
        Derive[Derive Content Key<br/>HKDF]
    end
    
    subgraph "Data Encryption"
        Plaintext[Property Data]
        Encrypt[Encrypt with<br/>XSalsa20-Poly1305]
        Encrypted[Encrypted Event]
    end
    
    subgraph "Key Sharing"
        ShareCode[Share Code]
        Seal[Seal Key with<br/>PBKDF2]
        SealedKey[Sealed Key]
    end
    
    Random --> KeyPair
    KeyPair --> Derive
    Derive --> Encrypt
    Plaintext --> Encrypt
    Encrypt --> Encrypted
    
    KeyPair --> Seal
    ShareCode --> Seal
    Seal --> SealedKey
```

## Event Sourcing Flow

```mermaid
graph TB
    subgraph "Event Creation"
        Action[User Action]
        Create[Create Event Object]
        Encrypt[Encrypt Event]
        Append[Append to Stream]
    end
    
    subgraph "Event Storage"
        EventLog[Event Log<br/>events.json]
        Event1[Event 1: EntityCreated]
        Event2[Event 2: PropertySet]
        Event3[Event 3: PropertySet]
        EventN[Event N: ...]
    end
    
    subgraph "Event Replay"
        Load[Load Events]
        Decrypt[Decrypt Events]
        Reduce[Reduce to State]
        State[Current State]
    end
    
    Action --> Create
    Create --> Encrypt
    Encrypt --> Append
    Append --> EventLog
    
    EventLog --> Event1
    EventLog --> Event2
    EventLog --> Event3
    EventLog --> EventN
    
    EventLog --> Load
    Load --> Decrypt
    Decrypt --> Reduce
    Reduce --> State
```

## Installation

### Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- Node.js 18+ (if not using Bun runtime)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd truetrace

# Install dependencies
bun install

# Start development server
bun run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
truetrace/
├── app/
│   ├── api/                 # Next.js API routes
│   │   ├── _lib/           # Storage utilities
│   │   ├── admin/          # Admin endpoints
│   │   ├── entities/       # Entity management
│   │   ├── invites/        # Device linking
│   │   ├── shares/         # Property sharing
│   │   └── session/        # Session management
│   ├── components/         # React components
│   │   ├── CopyableEntityId.tsx
│   │   ├── DevicesSection.tsx
│   │   ├── LoginView.tsx
│   │   ├── PropertiesSection.tsx
│   │   ├── SettingsSection.tsx
│   │   ├── SharingSection.tsx
│   │   └── Sidebar.tsx
│   ├── hooks/              # React hooks
│   │   ├── useEventStream.ts
│   │   └── useVault.ts
│   ├── lib/                # Core libraries
│   │   ├── api.ts          # API client
│   │   ├── crypto.ts       # Encryption utilities
│   │   ├── events.ts       # Event handling
│   │   ├── session.ts      # Session utilities
│   │   └── socket.ts       # Socket.IO instance
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── providers.tsx       # React Query provider
├── entities/               # Data storage (gitignored)
│   ├── _passkeys.json     # Passkey to entity mapping
│   ├── _shares.json        # Share codes
│   └── {entityId}/        # Per-entity data
│       ├── events.json     # Event log
│       └── shares.json     # Share records
├── server.ts               # Custom Next.js server with Socket.IO
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

### First Time Setup

1. **Login**: Click "Log In" and authenticate with your device's passkey (Touch ID, Face ID, Windows Hello, etc.)
2. **Create Properties**: Add key-value pairs in the Properties section
3. **Link Devices**: Generate an invite code in the Devices section and use it on another device

### Sharing Properties

1. **Create Share**: Select a property in the Sharing section and click "Create Share"
2. **Copy Share Code**: Copy the generated share code (expires after a set time)
3. **Accept Share**: On another entity, paste the share code in the "Accept a Share" section
4. **Real-Time Updates**: Changes to shared properties sync automatically

### Security Features

- **Zero-Knowledge Architecture**: Server never sees plaintext data
- **Client-Side Encryption**: All encryption/decryption happens in the browser
- **Secure Key Storage**: Entity keys stored encrypted in IndexedDB
- **Passkey Authentication**: No passwords to compromise
- **Share Expiration**: Share codes expire automatically

## API Endpoints

### Authentication
- `POST /api/session` - Create session
- `DELETE /api/session` - Clear session
- `GET /api/session` - Get current session

### Entities
- `POST /api/entities/init` - Initialize or create entity
- `POST /api/entities/link` - Link passkey to entity

### Invites
- `POST /api/invites/create` - Create device invite
- `POST /api/invites/consume` - Consume invite code

### Shares
- `POST /api/shares/create` - Create property share
- `POST /api/shares/consume` - Accept share code
- `POST /api/shares/revoke` - Revoke a share
- `GET /api/shares` - Get all shares

### Admin
- `POST /api/admin/reset` - Reset all data (development only)

## Socket.IO Events

### Client → Server
- `subscribe` - Subscribe to entity's event stream
- `unsubscribe` - Unsubscribe from entity
- `append` - Append new encrypted event

### Server → Client
- `replay` - Replay all existing events on subscribe
- `event` - New event for subscribed entity
- `sharedEvent` - Shared event from another entity
- `error` - Error message

## Security Considerations

### Encryption
- **Algorithm**: XSalsa20-Poly1305 (authenticated encryption)
- **Key Derivation**: HKDF for content keys, PBKDF2 for share/invite keys
- **Nonce**: Random nonce per encryption operation

### Key Management
- Entity private keys never leave the client unencrypted
- Keys wrapped with device-specific keys stored in IndexedDB
- Share keys sealed with share codes (PBKDF2)
- Invite keys sealed with invite codes (PBKDF2)

### Threat Model
- **Server Compromise**: Server cannot decrypt user data
- **Network Interception**: All data encrypted in transit (HTTPS) and at rest
- **Client Compromise**: Device keys protect entity keys
- **Share Code Leakage**: Share codes expire and are single-use

## Development

### Running in Development

```bash
bun run dev
```

### Building for Production

```bash
bun run build
bun run start
```

### Environment Variables

No environment variables required for basic operation. The server runs on `localhost:3000` by default.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: Bun
- **UI**: React 19
- **State Management**: React Query (TanStack Query)
- **Real-Time**: Socket.IO
- **Encryption**: libsodium-wrappers-sumo
- **Authentication**: @simplewebauthn/browser
- **Storage**: IndexedDB (idb-keyval), File System (JSON)
- **Styling**: CSS Modules with custom properties

## Contributing

We welcome contributions to TrueTrace! This document provides guidelines for contributing to the project.

### Getting Started

1. **Fork the repository** and clone your fork
2. **Create a branch** for your changes: `git checkout -b feature/your-feature-name`
3. **Make your changes** following our coding standards
4. **Test thoroughly** - ensure all existing tests pass and add tests for new features
5. **Commit your changes** with clear, descriptive commit messages
6. **Push to your fork** and open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/truetrace.git
cd truetrace

# Install dependencies
bun install

# Start development server
bun run dev
```

### Coding Standards

- **TypeScript**: Use TypeScript for all new code. Follow existing patterns and type definitions.
- **Code Style**: Follow the existing code style. Use consistent formatting (we recommend using your editor's auto-format).
- **Naming**: Use descriptive names for variables, functions, and components.
- **Comments**: Add comments for complex logic, but prefer self-documenting code.
- **Error Handling**: Always handle errors appropriately. Log errors for debugging but don't expose sensitive information.

### Security Considerations

- **Never commit secrets**: API keys, passwords, or private keys should never be committed.
- **Encryption**: Maintain the zero-knowledge architecture. Server should never decrypt user data.
- **Input Validation**: Validate and sanitize all user inputs.
- **Dependencies**: Keep dependencies up to date and review security advisories.

### Testing

- Test your changes manually in the browser
- Ensure the application works across different browsers (Chrome, Firefox, Safari, Edge)
- Test with multiple devices/passkeys when possible
- Verify encryption/decryption works correctly
- Test error scenarios and edge cases

### Pull Request Process

1. **Update Documentation**: Update README.md if you've changed functionality or added features
2. **Write Clear PR Description**: Explain what changes you made and why
3. **Reference Issues**: Link to any related issues in your PR description
4. **Keep PRs Focused**: One feature or fix per PR. Keep changesets small and reviewable.
5. **Respond to Feedback**: Be open to feedback and willing to make changes based on code review

### Commit Messages

Write clear, descriptive commit messages:

```
feat: Add property sharing between entities
fix: Resolve race condition in event queue
docs: Update README with architecture diagrams
refactor: Extract encryption logic to separate module
test: Add tests for share code generation
```

Use conventional commit prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Areas for Contribution

We particularly welcome contributions in these areas:

- **Security**: Security audits, vulnerability reports, encryption improvements
- **Performance**: Optimization of encryption/decryption, event processing, or UI rendering
- **UX/UI**: Improvements to user experience, accessibility, or visual design
- **Documentation**: Better documentation, examples, or tutorials
- **Testing**: Additional test coverage, integration tests, or E2E tests
- **Features**: New features that align with the project's goals (discuss in issues first)

### Reporting Issues

When reporting issues, please include:

- **Description**: Clear description of the issue
- **Steps to Reproduce**: Detailed steps to reproduce the problem
- **Expected Behavior**: What you expected to happen
- **Actual Behavior**: What actually happened
- **Environment**: Browser, OS, and version information
- **Screenshots**: If applicable, include screenshots or error messages

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect different viewpoints and experiences

### Questions?

If you have questions about contributing, feel free to:
- Open an issue with the `question` label
- Check existing issues and discussions
- Review the codebase to understand patterns

Thank you for contributing to TrueTrace! 🎉

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).

```
Copyright (C) 2026 TrueTrace Contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

### What This Means

- ✅ **You can use** this software for any purpose
- ✅ **You can modify** the source code
- ✅ **You can distribute** the software
- ✅ **You can distribute** your modifications

**However**, if you distribute modified versions:
- You must **license your modifications** under GPL-3.0
- You must **make source code available** to recipients
- You must **include the original license** and copyright notices
- You must **document your changes**

For more information, see the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

## Acknowledgments

- Built with security and privacy as core principles
- Uses industry-standard encryption libraries (libsodium)
- Follows WebAuthn standards for passkey authentication
