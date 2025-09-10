# Overview

This is a full-stack calendar application built with React (frontend) and Express.js (backend). The application provides a comprehensive task and time management system with calendar events, tasks, and time block notes. Users can create, manage, and organize calendar events, track tasks with different statuses and priorities, and add notes to specific time blocks. The application features a weekly calendar view with drag-and-drop functionality for task scheduling and real-time data management through React Query.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The frontend is built with **React 18** using **TypeScript** and **Vite** as the build tool. The application uses a modern component-based architecture with:

- **UI Framework**: Radix UI components with shadcn/ui design system for consistent, accessible interface components
- **Styling**: Tailwind CSS with custom CSS variables for theming and responsive design
- **State Management**: React Query (TanStack Query) for server state management, caching, and synchronization
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Drag & Drop**: React DND (Drag and Drop) for task scheduling functionality
- **Date Handling**: date-fns library for date manipulation and formatting

The frontend follows a clean architecture with separation of concerns:
- `/components/ui/` - Reusable UI components
- `/pages/` - Route-based page components
- `/hooks/` - Custom React hooks
- `/lib/` - Utility functions and API client

## Backend Architecture
The backend is built with **Node.js** and **Express.js** following RESTful API principles:

- **Server Framework**: Express.js with TypeScript for type safety
- **API Design**: RESTful endpoints for calendar events, tasks, and time block notes
- **Data Storage**: In-memory storage with interface abstraction for easy database migration
- **Validation**: Zod schemas shared between frontend and backend for consistent data validation
- **Error Handling**: Centralized error handling middleware
- **Development**: Hot reload with tsx and Vite integration for seamless development experience

The backend uses a repository pattern with an `IStorage` interface, allowing for easy swapping of storage implementations. Currently uses `MemStorage` for in-memory data persistence.

## Database Schema Design
The application defines three main entities using Drizzle ORM:

1. **Calendar Events**: Title, description, date, hour, and duration
2. **Tasks**: Title, description, priority levels (low/medium/high), status tracking (todo/upcoming/later), optional scheduling
3. **Time Block Notes**: Date and hour-specific notes for time organization
4. **Users**: Basic user authentication structure (username/password)

All entities use UUID primary keys and follow consistent date formatting (YYYY-MM-DD) and hour representation (0-23).

## External Dependencies

- **Database**: Configured for PostgreSQL through Drizzle ORM with Neon Database serverless driver
- **Development Tools**: Replit-specific plugins for development environment integration
- **Font Services**: Google Fonts integration (DM Sans, Fira Code, Geist Mono, Architects Daughter)
- **Build Tools**: ESBuild for production builds, PostCSS for CSS processing
- **Session Management**: Prepared for connect-pg-simple for PostgreSQL session storage