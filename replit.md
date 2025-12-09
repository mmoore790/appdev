# Moore Horticulture Equipment Management System

## Overview
This project is a comprehensive workshop operations system for Moore Horticulture Equipment. Its main purpose is to streamline operations for managing workshop jobs, customer data, equipment tracking, task assignments, and service history. The system aims to enhance efficiency in workshop operations, improve customer interaction through a dedicated portal, and provide robust tools for internal communication and tracking.

## User Preferences
Preferred communication style: Simple, everyday language.
Dashboard layout: Industry-standard design with exceptional clarity, removed total customers statistic, eliminated workshop jobs from welcome section, replaced customers quick action with callbacks linking to callback section, removed "completed this week" metric for focused view.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript
- **Components**: Shadcn/ui built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **Icons**: Lucide-react
- **Design Elements**: Professional A4 printable work completion certificates with company branding, professional payment request email templates with responsive design, custom favicon.
- **User Interface**: Simplified navigation with focus on "Workshop", "Task Board", and "Payments". Streamlined job forms. Combined View and Edit actions into single "View & Edit" button for reduced interface complexity. Smart help chatbot with category-organized FAQ system for user assistance.
- **Information Display**: Job creation dates in local timezone, exact date and time for callbacks, workshop capacity counters, date filters for jobs and callbacks, "Assigned To" filter for tasks, actual timestamps in payments section instead of relative times.
- **Job Creation**: Multi-step wizard interface for non-technical users with progress indicators, simplified customer input (name, email, phone), equipment details (brand, model, serial, description), and job description steps (work description, assignment). Job deletion capabilities from view/edit interface with cascade deletion of related records.

### Technical Implementations
- **Frontend**: React 18, TanStack Query for server state, Wouter for routing, Vite for builds, React Hook Form with Zod validation.
- **Backend**: Express.js with TypeScript, Drizzle ORM for PostgreSQL.
- **Authentication**: Session-based with `express-session` and `connect-pg-simple` for PostgreSQL session storage; role-based access control (admin, staff, mechanic); registration request approval workflow; `bcryptjs` for password hashing.
- **Core Functionality**:
    - **Workshop Operations**: Job creation, tracking (sequential IDs), status updates (including "Ready for Pickup" status triggering customer emails), equipment management, service history, work order generation.
    - **Task Management**: Creation, priority, status tracking, assignment to staff.
    - **Customer Interaction**: Public job tracking (requires job ID and email), customer notification system, callback requests, automated job receipt emails.
    - **Internal Communication**: Messaging, email notifications for job assignments, activity logging.
    - **Payment Integration**: Stripe checkout session integration with automated webhook processing for instant payment completion detection and job status updates.
    - **Reporting/Utilities**: Printable work completion certificates, error reporting feedback mechanism, intelligent help chatbot with comprehensive FAQ system.

### System Design Choices
- **Full-Stack Architecture**: React frontend, Express backend, PostgreSQL database.
- **Database Schema**: Comprehensive schema supporting users (with roles), registration requests, customers, equipment, jobs, tasks, service history, messages, callback requests, and payment requests.
- **Session Management**: Persistent session storage in PostgreSQL for enhanced reliability and security, especially in hosted environments.
- **Modularity**: Separation of concerns between frontend, backend, and database layers.
- **Scalability**: Utilizing serverless PostgreSQL and a robust session management system.
- **Security**: Secure password hashing, multi-tier authentication, validated job tracker access, and secure payment processing.
- **Email System**: SMTP implementation using Nodemailer for sending various notifications and reports.

## External Dependencies

### Core Dependencies
- `@neondatabase/serverless`: Serverless PostgreSQL database connection.
- `drizzle-orm`: Type-safe database ORM.
- `@tanstack/react-query`: Server state management.
- `bcryptjs`: Password hashing.
- `express-session`: Session management.
- `connect-pg-simple`: PostgreSQL session store.
- `nodemailer`: Email sending.
- `stripe`: Payment processing.

### UI Dependencies
- `@radix-ui/react-*`: Accessible UI primitives.
- `tailwindcss`: Utility-first CSS framework.
- `lucide-react`: Icon library.
- `react-hook-form`: Form handling.
- `zod`: Schema validation.
- `wouter`: Client-side routing.

### Development Dependencies
- `vite`: Build tool and dev server.
- `typescript`: Type safety.
- `drizzle-kit`: Database migrations.
- `tsx`: TypeScript execution.