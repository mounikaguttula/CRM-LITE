# CRM Lite — Generic Metadata-Driven Platform Engine

A production-ready **Metadata-Driven CRM Platform Backend** built with **Node.js**, **Express.js**, **Supabase (PostgreSQL)**, and **JWT Bearer Authentication**.

Unlike traditional hardcoded CRMs, this backend contains **zero object-specific controllers or services** (`leadsController.js`, `dealsController.js`, etc.). Every object type (Leads, Deals, Contacts, Employees, Students, Invoices, Assets, Projects) is powered dynamically by database metadata.

---

## 🏗️ Platform Architecture

```
backend/
├── .env.example              # Environment configuration template
├── package.json              # Express & Supabase dependencies
├── server.js                 # Express server entry point
├── schema.sql                # Supabase schema & metadata seeds
├── README.md                 # Technical platform documentation
│
├── config/
│   └── supabase.js           # Supabase client setup
│
├── middleware/
│   ├── auth.js               # JWT bearer authentication middleware
│   └── errorHandler.js       # Centralized error handler
│
├── utils/
│   └── response.js           # Standardized HTTP response utilities
│
├── controllers/
│   ├── authController.js     # User registration & authentication
│   ├── objectController.js   # Single generic CRUD controller for ALL objects
│   └── workspaceController.js# Dynamic workspace metadata controller
│
├── services/
│   ├── authService.js        # Authentication & password hashing logic
│   └── objectService.js      # Single generic CRUD engine using object_definitions
│
└── routes/
    ├── auth.js               # /auth routes
    ├── objects.js            # /objects/:objectType generic routes
    └── workspace.js          # /workspace routes
```

---

## ⚡ How a New Object is Created Without Code Changes

To add a brand new object type (e.g. `employees`, `projects`, `assets`, `students`):

1. **Insert Metadata Row into `object_type_definitions`**:
   ```sql
   INSERT INTO object_type_definitions (organization_id, api_name, display_name, description, icon)
   VALUES ('<your-organization-id>', 'employees', 'Employee', 'Employees', '👔');
   ```

2. **Insert Field Metadata Rows into `field_definitions`**:
   ```sql
   INSERT INTO field_definitions (organization_id, object_type_id, api_name, display_name, field_type, required)
   VALUES
     ('<your-organization-id>', '<object_type_id>', 'name', 'Employee Name', 'text', true),
     ('<your-organization-id>', '<object_type_id>', 'department', 'Department', 'text', true),
     ('<your-organization-id>', '<object_type_id>', 'email', 'Email Address', 'email', false);
   ```

3. **Result**:
   The backend instantly handles:
   - `GET /objects/employees`
   - `POST /objects/employees`
   - `GET /objects/employees/:id`
   - `PUT /objects/employees/:id`
   - `DELETE /objects/employees/:id`
   - `GET /objects/employees/fields`

**Zero server restarts, zero code modifications!**

---

## 📡 Generic REST API Routes

### Authentication (`/auth`)
- `POST /auth/login` — Login user & return JWT token
- `POST /auth/register-organization` — Register organization + admin user
- `GET /auth/me` — Restore user session profile

### Generic Object Engine (`/objects`)
- `GET /objects/:objectType` (or `GET /:objectType`) — List records for objectType
- `GET /objects/:objectType/:id` — Get single record by ID
- `POST /objects/:objectType` — Create record (validates against `field_definitions`)
- `PUT /objects/:objectType/:id` — Update record
- `DELETE /objects/:objectType/:id` — Delete record
- `GET /objects/:objectTypeId/fields` — Get field schema metadata
- `GET /objects/:objectTypeId/views` — Get column view layout rules

### Dynamic Workspace (`/workspace`)
- `GET /workspace/metadata` — Dynamically returns company info, navigation array derived from registered `object_definitions`, dashboard metrics, and `objectTypes` schemas.

---

## 🚀 Running the Backend

```bash
cd backend
npm install
cp .env.example .env
# Execute schema.sql in Supabase SQL Editor
npm run dev
```
Backend runs on `http://localhost:5000`.
