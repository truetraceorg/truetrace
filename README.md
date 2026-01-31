# TrueTrace Vault

A secure, end-to-end encrypted vault application with passkey authentication, real-time synchronization, and property sharing capabilities. Built with Next.js, Socket.IO, and libsodium for maximum security and privacy.

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

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

## Acknowledgments

- Built with security and privacy as core principles
- Uses industry-standard encryption libraries (libsodium)
- Follows WebAuthn standards for passkey authentication
