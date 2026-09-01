app/
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
│
└── (dashboard)/
    ├── layout.tsx
    ├── page.tsx
    ├── documents/
    └── chat/


# When not logged in, the user sees:
```
┌─────────────────────────────┐
│                             │
│        ┌─────────────┐      │
│        │   LOGIN     │      │
│        │             │      │
│        │ Email       │      │
│        │ Password    │      │
│        │             │      │
│        │   Log In    │      │
│        │             │      │
│        │ Don't have  │      │
│        │ an account? │      │
│        │ Register    │      │
│        └─────────────┘      │
│                             │
└─────────────────────────────┘
```

# When logged in
Once the user logs in, they enter your dashboard:
```
┌──────────────┬──────────────────────────┐
│              │                          │
│ Dashboard    │                          │
│ Documents    │       Main Content       │
│ Chat         │                          │
│              │                          │
│              │                          │
│ ───────────  │                          │
│ 👤 Account   │                          │
│ 🚪 Logout    │                          │
└──────────────┴──────────────────────────┘
```
(dashboard)/layout.tsx contains the persistent:
- Sidebar
- Navbar
- Logout button
- User/account
- No need for Login/Register buttons since person is already authenticated if they were able to see this page